from pydantic import BaseModel, Field
from typing import List, Dict, Optional

# ─── INCOMING REQUEST SCHEMAS ─────────────────────────────────────────────

class UnitTelemetry(BaseModel):
    """
    Incoming raw sensor telemetry for a single semiconductor unit during
    backend assembly.
    """
    unit_id: str = Field(..., description="Unique identifier for the unit")
    timestamp: str = Field(..., description="ISO 8601 timestamp")
    
    # 1. Die Attach
    bond_force: float = Field(default=0.0)
    xy_placement_offset: float = Field(default=0.0)
    bond_line_thickness: float = Field(default=0.0)
    epoxy_viscosity: float = Field(default=0.0)
    
    # 2. Wire Bonding
    pick_place_speed: float = Field(default=0.0)
    ultrasonic_power: float = Field(default=0.0)
    bond_time: float = Field(default=0.0)
    loop_height: float = Field(default=0.0)
    capillary_stroke_count: float = Field(default=0.0)
    efo_voltage: float = Field(default=0.0)
    
    # 3. Molding
    transfer_pressure: float = Field(default=0.0)
    clamping_force: float = Field(default=0.0)
    molding_temperature: float = Field(default=0.0)
    vacuum_level: float = Field(default=0.0)
    
    # 4. Solder Ball Attach
    ball_placement_accuracy: float = Field(default=0.0)
    laser_pulse_energy: float = Field(default=0.0)
    reflow_peak_temp: float = Field(default=0.0)
    flux_density: float = Field(default=0.0)
    
    # 5. Singulation
    spindle_current: float = Field(default=0.0)
    vibration_amplitude: float = Field(default=0.0)
    blade_wear_index: float = Field(default=0.0)
    cooling_water_flow: float = Field(default=0.0)
    
    # Computed Synthetic Context Features
    rrs_1: float = Field(default=0.0)
    rrs_2: float = Field(default=0.0)
    rrs_3: float = Field(default=0.0)
    rrs_4: float = Field(default=0.0)
    rrs_5: float = Field(default=0.0)
    rrs_delta_1: float = Field(default=0.0)
    rrs_delta_2: float = Field(default=0.0)
    rrs_delta_3: float = Field(default=0.0)
    rrs_delta_4: float = Field(default=0.0)
    rrs_delta_5: float = Field(default=0.0)
    machine_risk_score: float = Field(default=0.0)
    resin_batch_risk_score: float = Field(default=0.0)


class ExplainRequest(BaseModel):
    """Request schema for asking why a unit was flagged."""
    unit_data: UnitTelemetry


# ─── OUTGOING RESPONSE SCHEMAS ────────────────────────────────────────────

class RiskResponse(BaseModel):
    """
    Standardized response returning the Tri-Shield evaluation.
    """
    unit_id: str
    risk_score: float = Field(..., description="0-100 overall fused risk score")
    risk_level: str = Field(..., description="Approve, Flag, or Block")
    
    shield1_score: float = Field(..., description="LightGBM defect probability")
    shield2_score: float = Field(..., description="Isolation Forest anomaly score")
    shield3_score: float = Field(..., description="Physics rules violation score")
    
    reasons: List[str] = Field(default_factory=list, description="Human-readable triggers")
    engine_mode: str = Field(..., description="full, degraded, or static_rules")
    active_models: List[str] = Field(default_factory=list)
    latency_ms: float = Field(..., description="Engine execution time")


class ExplainFeature(BaseModel):
    feature: str
    shap_value: float
    direction: str

class ExplainResponse(BaseModel):
    """
    Response containing SHAP explainability data.
    """
    top_features: List[ExplainFeature]
    all_features: Dict[str, float]
