import numpy as np
from config import PARAM_COLUMNS, STAGE_PARAMS

def predict_coefficients(params_dict, coeff_model, scaler, poly=None):
    """Predicts POD coefficients from process parameters."""
    x = np.array([[params_dict.get(p, 0.0) for p in PARAM_COLUMNS]])
    x_scaled = scaler.transform(x)
    if poly is not None:
        x_scaled = poly.transform(x_scaled)
    return coeff_model.predict(x_scaled)[0]

def compute_sensitivity(unit_params: dict, pod_modes, mean_field, 
                         coeff_model, scaler, poly=None, delta_pct=0.01) -> dict:
    """
    Finite-difference sensitivity analysis.
    Perturb each parameter by ±delta_pct, measure change in max stress.
    
    With polynomial features, the model is nonlinear so sensitivities
    vary per unit (unlike plain Ridge which gives constant gradients).
    """
    # Baseline stress
    baseline_alpha = predict_coefficients(unit_params, coeff_model, scaler, poly)
    baseline_field = mean_field + pod_modes @ baseline_alpha
    baseline_max = np.max(baseline_field)
    
    sensitivities = {}
    for param in PARAM_COLUMNS:
        perturbed = unit_params.copy()
        original_val = perturbed.get(param, 0.0)
        
        if abs(original_val) > 1e-6:
            perturbed[param] = original_val * (1 + delta_pct)
        else:
            # For near-zero values, use absolute perturbation
            perturbed[param] = delta_pct
            
        pert_alpha = predict_coefficients(perturbed, coeff_model, scaler, poly)
        pert_field = mean_field + pod_modes @ pert_alpha
        pert_max = np.max(pert_field)
        
        sensitivities[param] = abs(pert_max - baseline_max)
        
    # Normalize to contribution fractions (sum to 1.0)
    total = sum(sensitivities.values())
    if total > 0:
        sensitivities = {k: v / total for k, v in sensitivities.items()}
        
    return dict(sorted(sensitivities.items(), key=lambda x: x[1], reverse=True))

def get_stage_attribution(sensitivities: dict) -> dict:
    """Sum per-parameter sensitivities by stage to find the root cause stage."""
    stage_scores = {}
    for stage, params in STAGE_PARAMS.items():
        stage_scores[stage] = sum(sensitivities.get(p, 0.0) for p in params)
    return dict(sorted(stage_scores.items(), key=lambda x: x[1], reverse=True))
