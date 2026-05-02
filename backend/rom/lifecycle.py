import numpy as np
import time

from config import GRID_SIZE
from sensitivity import compute_sensitivity, get_stage_attribution, predict_coefficients

def compute_lifecycle(unit_params: dict, pod_modes, mean_field, 
                      coeff_model, scaler, poly=None) -> dict:
    """
    Compute full lifecycle for a unit and return a JSON-ready dict for the frontend.
    """
    start = time.perf_counter()
    
    # 1. Full ROM reconstruction
    alpha = predict_coefficients(unit_params, coeff_model, scaler, poly)
    stress_field = mean_field + pod_modes @ alpha
    stress_2d = stress_field.reshape(GRID_SIZE, GRID_SIZE)
    
    reconstruction_ms = (time.perf_counter() - start) * 1000
    
    # 2. Extract existing CRI values from the unit data
    rrs_values = [
        unit_params.get('rrs_1', 0),
        unit_params.get('rrs_2', 0),
        unit_params.get('rrs_3', 0),
        unit_params.get('rrs_4', 0),
        unit_params.get('rrs_5', 0),
    ]
    
    rrs_deltas = [
        unit_params.get('rrs_delta_1', 0),
        unit_params.get('rrs_delta_2', 0),
        unit_params.get('rrs_delta_3', 0),
        unit_params.get('rrs_delta_4', 0),
        unit_params.get('rrs_delta_5', 0),
    ]
    
    # 3. Sensitivity analysis (root cause)
    sensitivities = compute_sensitivity(
        unit_params, pod_modes, mean_field, coeff_model, scaler, poly
    )
    stage_attribution = get_stage_attribution(sensitivities)
    
    # 4. Find the spike stage
    spike_stage_idx = int(np.argmax(rrs_deltas))
    stage_names = ['Die Bond', 'Wire Bond', 'Mold', 'Ball Attach', 'Saw']
    
    # 5. Risk level based on final CRI
    final_cri = rrs_values[-1] if rrs_values else 0
    if final_cri >= 0.6:
        risk_level = "CRITICAL"
    elif final_cri >= 0.4:
        risk_level = "WARNING"
    else:
        risk_level = "HEALTHY"
        
    return {
        "unit_id": unit_params.get('unit_id', 'UNKNOWN'),
        "bin_code": int(unit_params.get('bin_code', -1)),
        "risk_level": risk_level,
        
        "stress_map": {
            "grid_size": GRID_SIZE,
            "values": stress_2d.tolist(),
            "max_stress_mpa": round(float(np.max(stress_2d)), 2),
            "mean_stress_mpa": round(float(np.mean(stress_2d)), 2),
        },
        
        "cri_lifecycle": {
            "stages": stage_names,
            "cumulative_cri": [round(float(v), 4) for v in rrs_values],
            "stage_deltas": [round(float(d), 4) for d in rrs_deltas],
            "spike_stage": stage_names[spike_stage_idx],
            "spike_delta": round(float(rrs_deltas[spike_stage_idx]), 4),
            "risk_threshold": 0.6,
        },
        
        "root_cause": {
            "parameter_contributions": {k: round(v, 4) for k, v in 
                                         list(sensitivities.items())[:8]},
            "stage_contributions": {k: round(v, 4) for k, v in stage_attribution.items()},
            "primary_parameter": list(sensitivities.keys())[0] if sensitivities else None,
            "primary_stage": list(stage_attribution.keys())[0] if stage_attribution else None,
        },
        
        "rom_metadata": {
            "reconstruction_time_ms": round(reconstruction_ms, 2),
            "pod_modes_used": pod_modes.shape[1],
            "grid_points": GRID_SIZE * GRID_SIZE,
        }
    }
