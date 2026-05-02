import json
import matplotlib.pyplot as plt
import numpy as np

def plot_demo():
    try:
        with open('artifacts/demo_output.json', 'r') as f:
            data = json.load(f)
    except FileNotFoundError:
        print("Please run run_demo.py first.")
        return

    # Just plot the first unit
    unit = data[0]
    
    # 1. Plot Stress Map
    stress_2d = np.array(unit['stress_map']['values'])
    plt.figure(figsize=(6, 5))
    plt.imshow(stress_2d, cmap='jet', interpolation='nearest')
    plt.colorbar(label='von Mises Stress (MPa)')
    plt.title(f"ROM Reconstructed Stress Field\n{unit['unit_id']} (Max: {unit['stress_map']['max_stress_mpa']} MPa)")
    plt.tight_layout()
    plt.savefig('artifacts/stress_map.png')
    plt.close()
    
    # 2. Plot CRI Lifecycle
    stages = unit['cri_lifecycle']['stages']
    cri_vals = unit['cri_lifecycle']['cumulative_cri']
    
    plt.figure(figsize=(8, 4))
    plt.plot(stages, cri_vals, marker='o', linewidth=2, color='darkorange')
    plt.axhline(y=0.6, color='r', linestyle='--', label='Risk Threshold')
    plt.fill_between(stages, cri_vals, alpha=0.3, color='orange')
    plt.title(f"Cumulative Reliability Index (CRI) Trend\n{unit['unit_id']} - Spike at {unit['cri_lifecycle']['spike_stage']}")
    plt.ylabel('CRI')
    plt.ylim(0, 1.0)
    plt.grid(alpha=0.3)
    plt.legend()
    plt.tight_layout()
    plt.savefig('artifacts/cri_trend.png')
    plt.close()
    
    # 3. Plot Root Cause
    params = list(unit['root_cause']['parameter_contributions'].keys())
    contribs = list(unit['root_cause']['parameter_contributions'].values())
    
    # Reverse to plot highest on top
    params = params[::-1]
    contribs = contribs[::-1]
    
    plt.figure(figsize=(8, 5))
    bars = plt.barh(params, [c * 100 for c in contribs], color='teal')
    if bars:
        bars[-1].set_color('crimson') # Highlight the primary root cause
    plt.xlabel('Contribution to Stress (%)')
    plt.title(f"Physics Sensitivity Analysis - Root Cause\nPrimary: {unit['root_cause']['primary_parameter']}")
    plt.tight_layout()
    plt.savefig('artifacts/root_cause.png')
    plt.close()
    
    print("Generated plots in artifacts/ directory:")
    print(" - artifacts/stress_map.png")
    print(" - artifacts/cri_trend.png")
    print(" - artifacts/root_cause.png")

if __name__ == '__main__':
    plot_demo()
