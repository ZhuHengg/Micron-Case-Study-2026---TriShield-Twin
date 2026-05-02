"""
ROM Pipeline Diagnostic — Finds all bugs before production use.
"""
import numpy as np
import pandas as pd
import pickle

from config import PARAM_COLUMNS, GRID_SIZE
from stress_model import compute_stress_field
from sensitivity import compute_sensitivity, predict_coefficients
from lifecycle import compute_lifecycle

def load_artifacts():
    pod_modes = np.load('artifacts/pod_modes.npy')
    mean_field = np.load('artifacts/mean_field.npy')
    with open('artifacts/coeff_model.pkl', 'rb') as f:
        data = pickle.load(f)
    return pod_modes, mean_field, data['model'], data['scaler'], data.get('poly', None)

def main():
    print("="*70)
    print("ROM DIAGNOSTIC EVALUATION")
    print("="*70)

    pod_modes, mean_field, coeff_model, scaler, poly = load_artifacts()
    df = pd.read_csv('../data/synthetic_backend_assembly.csv')
    
    bugs = []

    # ---------------------------------------------------------------
    # TEST 1: Stress model determinism
    # ---------------------------------------------------------------
    print("\n[TEST 1] Stress model determinism...")
    row = df.iloc[0].to_dict()
    f1 = compute_stress_field(row)
    f2 = compute_stress_field(row)
    if np.allclose(f1, f2):
        print("  PASS — Same input produces identical output.")
    else:
        bugs.append("Stress model is non-deterministic!")
        print("  FAIL — Non-deterministic!")

    # ---------------------------------------------------------------
    # TEST 2: Healthy vs Defective stress separation
    # ---------------------------------------------------------------
    print("\n[TEST 2] Stress separation — healthy vs defective...")
    healthy_sample = df[df['bin_code'] == 1].sample(50, random_state=42)
    defective_sample = df[df['bin_code'] >= 5].sample(50, random_state=42)
    
    healthy_max = [np.max(compute_stress_field(r.to_dict())) for _, r in healthy_sample.iterrows()]
    defect_max = [np.max(compute_stress_field(r.to_dict())) for _, r in defective_sample.iterrows()]
    
    h_avg = np.mean(healthy_max)
    d_avg = np.mean(defect_max)
    print(f"  Healthy avg max stress: {h_avg:.1f} MPa")
    print(f"  Defective avg max stress: {d_avg:.1f} MPa")
    if d_avg > h_avg * 1.2:
        print(f"  PASS — Defective is {d_avg/h_avg:.1f}x higher.")
    else:
        bugs.append(f"Weak separation: defective ({d_avg:.1f}) vs healthy ({h_avg:.1f})")
        print(f"  FAIL — Weak separation (only {d_avg/h_avg:.2f}x).")

    # ---------------------------------------------------------------
    # TEST 3: ROM reconstruction error on held-out units
    # ---------------------------------------------------------------
    print("\n[TEST 3] ROM reconstruction error on 50 held-out units...")
    test_sample = df.sample(50, random_state=99)
    errors = []
    for _, row in test_sample.iterrows():
        params = row.to_dict()
        ground_truth = compute_stress_field(params).flatten()
        
        alpha = predict_coefficients(params, coeff_model, scaler, poly)
        reconstructed = mean_field + pod_modes @ alpha
        
        err = np.linalg.norm(reconstructed - ground_truth) / np.linalg.norm(ground_truth)
        errors.append(err)
    
    avg_err = np.mean(errors) * 100
    max_err = np.max(errors) * 100
    print(f"  Avg error: {avg_err:.1f}%   Max error: {max_err:.1f}%")
    if avg_err > 10:
        bugs.append(f"High reconstruction error: avg={avg_err:.1f}%, max={max_err:.1f}%")
        print(f"  FAIL — Should be <10%.")
    else:
        print(f"  PASS")

    # ---------------------------------------------------------------
    # TEST 4: Sensitivity analysis — does it vary per unit?
    # ---------------------------------------------------------------
    print("\n[TEST 4] Sensitivity analysis — per-unit variation...")
    # Pick a clearly healthy and clearly defective unit
    unit_a = df[(df['bin_code'] == 1) & (df['rrs_5'] < 0.3)].iloc[0].to_dict()
    unit_b = df[(df['bin_code'] >= 6) & (df['rrs_5'] > 0.5)].iloc[0].to_dict()
    
    sens_a = compute_sensitivity(unit_a, pod_modes, mean_field, coeff_model, scaler, poly)
    sens_b = compute_sensitivity(unit_b, pod_modes, mean_field, coeff_model, scaler, poly)
    
    top_a = list(sens_a.keys())[0]
    top_b = list(sens_b.keys())[0]
    
    print(f"  Healthy unit top cause: {top_a} ({sens_a[top_a]*100:.1f}%)")
    print(f"  Defective unit top cause: {top_b} ({sens_b[top_b]*100:.1f}%)")
    
    # Check if top-3 differ
    top3_a = set(list(sens_a.keys())[:3])
    top3_b = set(list(sens_b.keys())[:3])
    overlap = len(top3_a & top3_b)
    
    if top_a == top_b and overlap == 3:
        bugs.append(f"Sensitivity is CONSTANT — identical top-3 for both units.")
        print(f"  FAIL — Identical top-3 root causes.")
    else:
        print(f"  PASS — Top-3 overlap: {overlap}/3 (some variation exists)")

    # ---------------------------------------------------------------
    # TEST 5: Demo sample selection check
    # ---------------------------------------------------------------
    print("\n[TEST 5] Demo sample quality...")
    # Check what percentile the low-RRS units are at
    p10 = df[df['bin_code'] == 1]['rrs_5'].quantile(0.10)
    p25 = df[df['bin_code'] == 1]['rrs_5'].quantile(0.25)
    median_rrs = df[df['bin_code'] == 1]['rrs_5'].median()
    print(f"  Bin 1 RRS_5 distribution: p10={p10:.4f}, p25={p25:.4f}, median={median_rrs:.4f}")
    
    healthy_pool = df[(df['bin_code'] == 1) & (df['rrs_5'] < p25)]
    print(f"  Available Bin 1 units below p25 ({p25:.4f}): {len(healthy_pool)}")
    if len(healthy_pool) == 0:
        bugs.append("Cannot find low-RRS Bin 1 units for demo.")
        print("  FAIL")
    else:
        best = healthy_pool.nsmallest(1, 'rrs_5').iloc[0]
        print(f"  Best healthy unit: RRS_5={best['rrs_5']:.4f}  <- PASS")
    
    defective_pool = df[(df['bin_code'] >= 5) & (df['rrs_5'] > 0.6)]
    print(f"  Available defective units with RRS_5 > 0.6: {len(defective_pool)}")
    if len(defective_pool) == 0:
        bugs.append("No defective units with RRS_5 > 0.6!")
        print("  FAIL")
    else:
        worst = defective_pool.nlargest(1, 'rrs_5').iloc[0]
        print(f"  Best defective unit: RRS_5={worst['rrs_5']:.4f}, Bin={int(worst['bin_code'])}  <- PASS")

    # ---------------------------------------------------------------
    # TEST 6: POD mode count
    # ---------------------------------------------------------------
    print(f"\n[TEST 6] POD mode count...")
    S = np.load('artifacts/singular_values.npy')
    energy = np.cumsum(S**2) / np.sum(S**2)
    k = pod_modes.shape[1]
    print(f"  Using k={k} modes ({energy[k-1]*100:.2f}% energy)")
    for check_k in [3, 5, 10, 15]:
        if check_k <= len(S):
            print(f"  k={check_k} -> {energy[check_k-1]*100:.2f}%")

    # ---------------------------------------------------------------
    # SUMMARY
    # ---------------------------------------------------------------
    print("\n" + "="*70)
    if bugs:
        print(f"FOUND {len(bugs)} ISSUE(S):")
        for i, b in enumerate(bugs, 1):
            print(f"  [{i}] {b}")
    else:
        print("ALL TESTS PASSED.")
    print("="*70)

if __name__ == '__main__':
    main()
