import json
import os
import pandas as pd
import numpy as np
import pickle

from .lifecycle import compute_lifecycle

def run_demo():
    print("="*60)
    print("ROM DIGITAL TWIN -- DEMO RUNNER")
    print("="*60)
    
    # 1. Load artifacts
    print("Loading ROM artifacts...")
    try:
        pod_modes = np.load('artifacts/pod_modes.npy')
        mean_field = np.load('artifacts/mean_field.npy')
        with open('artifacts/coeff_model.pkl', 'rb') as f:
            data = pickle.load(f)
            coeff_model = data['model']
            scaler = data['scaler']
            poly = data.get('poly', None)  # May not exist in older artifacts
    except FileNotFoundError:
        print("Artifacts not found! Run build_rom.py first.")
        return

    # 2. Load data and select GOOD demo samples
    print("Loading synthetic dataset...")
    df = pd.read_csv('../data/synthetic_backend_assembly.csv')
    
    # Pick a genuinely healthy Bin 1 unit (lowest RRS_5 available)
    healthy_pool = df[df['bin_code'] == 1].nsmallest(20, 'rrs_5')
    healthy_unit = healthy_pool.iloc[0].to_dict()
    
    # Pick a clearly defective unit (high RRS_5, from a root-cause stage)
    defective_pool = df[(df['bin_code'] >= 5) & (df['rrs_5'] > 0.6)]
    if len(defective_pool) == 0:
        defective_pool = df[df['bin_code'] >= 5].nlargest(10, 'rrs_5')
    defective_unit = defective_pool.iloc[0].to_dict()
    
    # 3. Run ROM pipeline
    print("\nRunning ROM pipeline...")
    results = []
    
    for label, unit in [("DEFECTIVE", defective_unit), ("HEALTHY", healthy_unit)]:
        output = compute_lifecycle(unit, pod_modes, mean_field, coeff_model, scaler, poly)
        results.append(output)
        
        print(f"\n[{label}] Unit: {output['unit_id']}  |  Bin: {output['bin_code']}")
        print(f"  ROM Reconstruction: {output['rom_metadata']['reconstruction_time_ms']:.2f} ms")
        print(f"  Max Stress: {output['stress_map']['max_stress_mpa']} MPa")
        print(f"  Mean Stress: {output['stress_map']['mean_stress_mpa']} MPa")
        print(f"  Final CRI: {output['cri_lifecycle']['cumulative_cri'][-1]}  [{output['risk_level']}]")
        print(f"  CRI Trend: {output['cri_lifecycle']['cumulative_cri']}")
        
        spike = output['cri_lifecycle']['spike_stage']
        delta = output['cri_lifecycle']['spike_delta']
        print(f"  Spike Stage: {spike} (+{delta})")
        
        # Root cause summary
        print(f"  Root Cause (by parameter):")
        for param, contrib in list(output['root_cause']['parameter_contributions'].items())[:3]:
            print(f"    {param}: {contrib*100:.1f}%")
        print(f"  Root Cause (by stage):")
        for stage, contrib in output['root_cause']['stage_contributions'].items():
            print(f"    {stage}: {contrib*100:.1f}%")

    # 4. Save JSON
    out_path = 'artifacts/demo_output.json'
    with open(out_path, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved full JSON payload to {out_path}")
    print("="*60)

if __name__ == '__main__':
    run_demo()
