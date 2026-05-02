import time
import logging
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import numpy as np
import pickle

# Import our custom Inference Engine and Schemas
from api.inference import EnsembleEngine
from api.schemas import UnitTelemetry, RiskResponse, ExplainRequest, ExplainResponse, ROMSimulateRequest
from rom.lifecycle import compute_lifecycle

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# ─── 1. INITIALIZE FASTAPI APP ──────────────────────────────────────────
app = FastAPI(
    title="Micron Tri-Shield API",
    description="Real-time predictive quality engine for semiconductor backend assembly.",
    version="1.0.0"
)

# ─── 2. CORS CONFIGURATION ──────────────────────────────────────────────
# Allows the Vite frontend (usually running on port 5173 or 3000) to securely
# connect and request data from this backend API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, this should be specific origins (e.g., ["http://localhost:5173"])
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── 3. LOAD TRI-SHIELD ENGINE & ROM ────────────────────────────────────
try:
    pod_modes = np.load('rom/artifacts/pod_modes.npy')
    mean_field = np.load('rom/artifacts/mean_field.npy')
    with open('rom/artifacts/coeff_model.pkl', 'rb') as f:
        rom_data = pickle.load(f)
        coeff_model = rom_data['model']
        rom_scaler = rom_data['scaler']
        rom_poly = rom_data.get('poly', None)
    logger.info("ROM artifacts loaded successfully.")
except Exception as e:
    logger.error(f"Failed to load ROM artifacts: {e}")
    pod_modes = mean_field = coeff_model = rom_scaler = rom_poly = None

logger.info("Initializing Tri-Shield Ensemble Engine...")
try:
    engine = EnsembleEngine(
        iso_model_dir='models/unsupervised/outputs/model',
        lgb_model_dir='models/supervised/outputs/model',
        ensemble_dir='models/ensemble/outputs/model'
    )
    logger.info("Engine loaded successfully.")
except Exception as e:
    logger.error(f"Failed to load engine on startup: {e}")
    engine = None

# ─── 4. API ENDPOINTS ───────────────────────────────────────────────────

@app.get("/health")
def health_check():
    """Simple heartbeat check for load balancers and frontend status indicators."""
    status = "healthy" if engine else "degraded (models not loaded)"
    return {"status": status, "version": "1.0.0"}


@app.post("/predict", response_model=RiskResponse)
def predict_risk(telemetry: UnitTelemetry):
    """
    HOT PATH: Core real-time scoring endpoint.
    Takes incoming sensor telemetry from the factory floor and routes it
    through the Tri-Shield engine (LGB + IF + Physics) to determine if the
    unit should be Approved, Flagged, or Blocked.
    """
    if not engine:
        raise HTTPException(status_code=503, detail="Inference engine is not initialized")

    try:
        # Convert Pydantic object to dictionary for the engine
        unit_dict = telemetry.model_dump()
        
        # Route through the Tri-Shield prediction engine
        result = engine.predict(unit_dict)
        
        # Inject the unit_id from the request back into the response
        result['unit_id'] = telemetry.unit_id
        
        return result

    except Exception as e:
        logger.error(f"Prediction failed for unit {telemetry.unit_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/explain", response_model=ExplainResponse)
def explain_decision(request: ExplainRequest):
    """
    COLD PATH: Explainability endpoint.
    Triggered manually when an engineer clicks "Explain" on the dashboard.
    Runs the SHAP TreeExplainer to determine EXACTLY which sensor features
    drove the LightGBM model to flag the unit.
    """
    if not engine or not engine.explainer:
        raise HTTPException(status_code=503, detail="SHAP Explainer is not initialized")

    try:
        unit_dict = request.unit_data.model_dump()
        explanation = engine.explain(unit_dict)
        
        if 'error' in explanation:
            raise HTTPException(status_code=500, detail=explanation['error'])
            
        return explanation

    except Exception as e:
        logger.error(f"Explanation failed for unit {request.unit_data.unit_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rom/simulate")
def rom_simulate(params: ROMSimulateRequest):
    if pod_modes is None:
        raise HTTPException(status_code=503, detail="ROM artifacts not loaded")
    try:
        result = compute_lifecycle(
            params.model_dump(), pod_modes, mean_field,
            coeff_model, rom_scaler, rom_poly
        )
        return result
    except Exception as e:
        logger.error(f"ROM simulation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ─── GLOBAL EXCEPTION HANDLER ───────────────────────────────────────────
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled server error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal Server Error", "message": str(exc)},
    )
