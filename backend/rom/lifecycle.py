import numpy as np
import time

from .config import GRID_SIZE, PARAM_COLUMNS, STAGE_PARAMS, NOMINAL
from .sensitivity import compute_sensitivity, get_stage_attribution, predict_coefficients

# ─── Stage-wise CRI computation from ROM stress ────────────────────────────
# Stress threshold (MPa) where CRI = 1.0.  Tuned so that extreme-deviation
# sandbox settings produce CRI values in a visually meaningful 0 → 1 range.
_CRI_STRESS_CAP = 250.0


def _compute_stage_cri(unit_params: dict, pod_modes, mean_field,
                       coeff_model, scaler, poly) -> tuple:
    """
    Compute per-stage CRI deltas and cumulative CRI by measuring how much
    each manufacturing stage *adds* to the reconstructed max-stress relative
    to a perfect nominal baseline.

    Returns (cumulative_cri, stage_deltas) — both length-5 lists.
    """
    stage_names_ordered = ['Die Bond', 'Wire Bond', 'Mold', 'Ball Attach', 'Saw']

    # 1. Baseline: stress when ALL params are at nominal
    nominal_copy = {p: NOMINAL.get(p, unit_params.get(p, 0.0)) for p in PARAM_COLUMNS}
    baseline_alpha = predict_coefficients(nominal_copy, coeff_model, scaler, poly)
    baseline_field = mean_field + pod_modes @ baseline_alpha
    baseline_max = float(np.max(baseline_field))

    # 2. Progressively introduce each stage's actual parameters
    progressive = dict(nominal_copy)          # start fully nominal
    cumulative_cri = []
    stage_deltas = []
    prev_cri = 0.0

    for stage_name in stage_names_ordered:
        stage_params = STAGE_PARAMS[stage_name]
        for p in stage_params:
            progressive[p] = unit_params.get(p, NOMINAL.get(p, 0.0))

        alpha = predict_coefficients(progressive, coeff_model, scaler, poly)
        field = mean_field + pod_modes @ alpha
        current_max = float(np.max(field))

        # CRI = how far the max stress has risen above the ideal baseline,
        # normalized so _CRI_STRESS_CAP maps to 1.0
        stress_rise = max(current_max - baseline_max, 0.0)
        cri = min(stress_rise / _CRI_STRESS_CAP, 1.0)

        delta = max(cri - prev_cri, 0.0)
        cumulative_cri.append(cri)
        stage_deltas.append(delta)
        prev_cri = cri

    return cumulative_cri, stage_deltas


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
    
    # 2. CRI Lifecycle — derive from ROM stress physics
    #    If the caller already supplies rrs_1..5 (e.g. from a real unit DB row),
    #    use those.  Otherwise (sandbox mode), compute from the stress field.
    has_precomputed_rrs = any(
        unit_params.get(f'rrs_{i}', 0) != 0 for i in range(1, 6)
    )

    if has_precomputed_rrs:
        rrs_values = [unit_params.get(f'rrs_{i}', 0) for i in range(1, 6)]
        rrs_deltas = [unit_params.get(f'rrs_delta_{i}', 0) for i in range(1, 6)]
    else:
        rrs_values, rrs_deltas = _compute_stage_cri(
            unit_params, pod_modes, mean_field, coeff_model, scaler, poly
        )
    
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
