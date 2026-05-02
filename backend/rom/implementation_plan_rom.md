# ROM Digital Twin — Rapid Prototype Implementation Plan
## 1-Day Sprint Specification

> **Goal**: End-to-end ROM pipeline that takes a unit's 23 process parameters and outputs a 2D stress map, CRI lifecycle trend, and root-cause attribution — fast enough for real-time dashboard use.

---

## File Structure

```
backend/rom/
├── implementation_plan_rom.md    # THIS FILE
├── config.py                     # All constants, grid size, param definitions
├── stress_model.py               # Phase 1: Synthetic stress field generator
├── build_rom.py                  # Phase 2: Snapshot generation + SVD + coefficient predictor
├── sensitivity.py                # Phase 3: Finite-difference root cause analysis
├── lifecycle.py                  # Phase 4: 5-stage cumulative loop + JSON output
├── run_demo.py                   # Ties it all together, produces demo output
└── artifacts/                    # Generated outputs
    ├── pod_modes.npy
    ├── mean_field.npy
    ├── singular_values.npy
    ├── coeff_model.pkl
    └── demo_output.json
```

**Dependencies**: `numpy`, `pandas`, `scikit-learn`, `json` (all already available).

---

## Phase 1: Synthetic Stress Field Generator
**File**: `stress_model.py`
**Time budget**: ~2 hours
**Purpose**: A function that maps 23 process parameters → a 50×50 stress grid.

### Design

This is NOT a real FEA solver. It is a **parameterized surrogate** that produces physics-plausible stress patterns. The spatial patterns are constructed by superimposing Gaussian "hotspot" basis functions whose amplitudes and positions are driven by the process parameters.

### Core Function Signature

```python
def compute_stress_field(params: dict) -> np.ndarray:
    """
    Maps 23 process parameters to a 50x50 von Mises stress grid.
    
    Args:
        params: dict with keys matching CSV columns
                (bond_force, xy_placement_offset, ..., cooling_water_flow)
    
    Returns:
        stress_field: np.ndarray of shape (50, 50), values in MPa
    """
```

### How It Works — Superposition of 5 Stage Contributions

The chip package is modeled as a 50×50 grid (normalized coordinates 0–1 on both axes). Each manufacturing stage contributes a stress pattern:

```
σ_total(x, y) = σ_stage1(x,y) + σ_stage2(x,y) + σ_stage3(x,y) + σ_stage4(x,y) + σ_stage5(x,y)
```

Each stage's contribution is a **weighted sum of Gaussian hotspots** at physically meaningful locations:

#### Stage 1 — Die Bond: Stress concentrates at die center and corners
- **Hotspot locations**: center (0.5, 0.5) and 4 corners (0.2,0.2), (0.8,0.2), (0.2,0.8), (0.8,0.8)
- **Amplitude drivers**: `bond_force` deviation, `xy_placement_offset`, `bond_line_thickness` deviation
- **Physics logic**: Low bond force → poor adhesion → higher interfacial stress at die edges. High placement offset → asymmetric stress at corners.

```python
# Stage 1 contribution (pseudocode)
force_dev = abs(params['bond_force'] - 30.0) / 5.0
offset_norm = params['xy_placement_offset'] / 15.0
blt_dev = abs(params['bond_line_thickness'] - 25.0) / 7.0

# Center hotspot: driven by bond force
amplitude_center = force_dev * 40  # MPa scale
# Corner hotspots: driven by placement offset (asymmetric if offset is high)
amplitude_corners = offset_norm * 30 + blt_dev * 20
```

#### Stage 2 — Wire Bond: Stress along wire bond pad ring
- **Hotspot locations**: ring of points at radius ~0.35 from center (pad locations)
- **Amplitude drivers**: `ultrasonic_power` deviation, `loop_height` deviation, `capillary_stroke_count`
- **Physics logic**: Weak ultrasonic bond → stress concentration at bond foot. Worn capillary → inconsistent bonds → localized stress.

#### Stage 3 — Mold: Broad thermal stress across entire package
- **Hotspot locations**: broad Gaussian covering most of the grid (σ_gaussian = 0.3)
- **Amplitude drivers**: `molding_temperature` deviation, `vacuum_level`, `transfer_pressure` deviation
- **Physics logic**: CTE mismatch between mold compound and die creates thermal stress proportional to ΔT from cure temperature. Poor vacuum → voids → stress concentrators.

#### Stage 4 — Ball Attach: Stress at solder ball locations (bottom edge)
- **Hotspot locations**: row of points along y=0.9 (bottom of package, BGA side)
- **Amplitude drivers**: `reflow_peak_temp` deviation, `ball_placement_accuracy`, `flux_density` deviation
- **Physics logic**: Thermal overshoot → intermetallic growth → brittle joints. Misaligned balls → eccentric loading.

#### Stage 5 — Saw: Edge stress along package perimeter
- **Hotspot locations**: 4 edges of the grid (x≈0, x≈1, y≈0, y≈1)
- **Amplitude drivers**: `vibration_amplitude`, `blade_wear_index`, `spindle_current` deviation
- **Physics logic**: Saw-induced chipping creates microcracks at edges. Worn blade + high vibration = deeper damage zone.

### Gaussian Hotspot Helper

```python
def gaussian_hotspot(grid_x, grid_y, cx, cy, sigma, amplitude):
    """Single 2D Gaussian centered at (cx, cy)."""
    return amplitude * np.exp(-((grid_x - cx)**2 + (grid_y - cy)**2) / (2 * sigma**2))
```

### Baseline Stress

Add a uniform baseline of ~20 MPa (residual stress from wafer fab) so the field is never zero. Final field is clipped to [0, 300] MPa.

### Key Constraint

The function must be **deterministic** — same params always produce the same stress field. No randomness inside. All variation comes from the input parameters.

---

## Phase 2: Snapshot Matrix + SVD + Coefficient Predictor
**File**: `build_rom.py`  
**Time budget**: ~1.5 hours
**Purpose**: Build the ROM basis (POD modes) and train a coefficient predictor.

### Step 2A: Generate Snapshot Matrix

```python
# 1. Load the synthetic CSV
df = pd.read_csv('../data/synthetic_backend_assembly.csv')

# 2. Sample N_SNAPSHOTS diverse units (stratified by bin_code for coverage)
#    Use N_SNAPSHOTS = 50 for speed prototype
samples = df.groupby('bin_code', group_keys=False).apply(
    lambda x: x.sample(min(len(x), 7), random_state=42)
).head(N_SNAPSHOTS)

# 3. For each sampled unit, compute the full stress field
snapshot_matrix = np.zeros((N_GRID_TOTAL, N_SNAPSHOTS))  # (2500, 50)
for i, (_, row) in enumerate(samples.iterrows()):
    params = row.to_dict()
    snapshot_matrix[:, i] = compute_stress_field(params).flatten()

# 4. Subtract mean field (centering for SVD)
mean_field = snapshot_matrix.mean(axis=1)  # (2500,)
centered = snapshot_matrix - mean_field[:, np.newaxis]
```

### Step 2B: Perform SVD

```python
U, S, Vt = np.linalg.svd(centered, full_matrices=False)

# Determine k using 99% energy criterion
energy = np.cumsum(S**2) / np.sum(S**2)
k = np.searchsorted(energy, 0.99) + 1
k = min(k, 20)  # Cap at 20 for prototype

# Truncate
pod_modes = U[:, :k]  # (2500, k) — the "DNA" basis
coefficients = np.diag(S[:k]) @ Vt[:k, :]  # (k, 50) — training labels

# Save
np.save('artifacts/pod_modes.npy', pod_modes)
np.save('artifacts/mean_field.npy', mean_field)
np.save('artifacts/singular_values.npy', S)
```

### Step 2C: Train Coefficient Predictor

Map the 23 process parameters → k POD coefficients using Ridge regression.

```python
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
import pickle

# Feature matrix: 23 process params for each of the 50 sampled units
PARAM_COLUMNS = [
    'bond_force', 'xy_placement_offset', 'bond_line_thickness',
    'epoxy_viscosity', 'pick_place_speed',
    'ultrasonic_power', 'bond_time', 'loop_height',
    'capillary_stroke_count', 'efo_voltage',
    'transfer_pressure', 'clamping_force', 'molding_temperature', 'vacuum_level',
    'ball_placement_accuracy', 'laser_pulse_energy', 'reflow_peak_temp', 'flux_density',
    'spindle_current', 'vibration_amplitude', 'blade_wear_index', 'cooling_water_flow'
]
# Note: 22 numeric params (resin_batch_id is categorical, exclude it)

X_train = samples[PARAM_COLUMNS].values  # (50, 22)
Y_train = coefficients.T                  # (50, k)

scaler = StandardScaler()
X_scaled = scaler.fit_transform(X_train)

model = Ridge(alpha=1.0)
model.fit(X_scaled, Y_train)

# Save
with open('artifacts/coeff_model.pkl', 'wb') as f:
    pickle.dump({'model': model, 'scaler': scaler}, f)
```

### Validation Check

```python
# Reconstruct a training unit and compare to ground truth
alpha_pred = model.predict(scaler.transform(X_train[:1]))
reconstructed = mean_field + pod_modes @ alpha_pred.flatten()
ground_truth = snapshot_matrix[:, 0]
error = np.linalg.norm(reconstructed - ground_truth) / np.linalg.norm(ground_truth)
print(f"Relative reconstruction error: {error:.4f}")  # Should be < 0.05
```

---

## Phase 3: Sensitivity Analysis (Root Cause Engine)
**File**: `sensitivity.py`
**Time budget**: ~1 hour
**Purpose**: For a given unit, determine which parameter contributes most to the stress.

### Core Function

```python
def compute_sensitivity(unit_params: dict, pod_modes, mean_field, coeff_model, scaler,
                        delta_pct=0.01) -> dict:
    """
    Finite-difference sensitivity: perturb each parameter by ±delta_pct,
    measure change in max stress.
    
    Returns:
        dict mapping param_name -> contribution_fraction (sums to 1.0)
    """
    # Baseline stress
    baseline_alpha = predict_coefficients(unit_params, coeff_model, scaler)
    baseline_field = mean_field + pod_modes @ baseline_alpha
    baseline_max = np.max(baseline_field)
    
    sensitivities = {}
    for param in PARAM_COLUMNS:
        perturbed = unit_params.copy()
        original_val = perturbed[param]
        
        # Perturb by +delta_pct
        if original_val != 0:
            perturbed[param] = original_val * (1 + delta_pct)
        else:
            perturbed[param] = delta_pct  # Avoid zero division
        
        pert_alpha = predict_coefficients(perturbed, coeff_model, scaler)
        pert_field = mean_field + pod_modes @ pert_alpha
        pert_max = np.max(pert_field)
        
        sensitivities[param] = abs(pert_max - baseline_max)
    
    # Normalize to contribution fractions
    total = sum(sensitivities.values())
    if total > 0:
        sensitivities = {k: v / total for k, v in sensitivities.items()}
    
    # Sort descending
    return dict(sorted(sensitivities.items(), key=lambda x: x[1], reverse=True))
```

### Output Format

```python
{
    "molding_temperature": 0.42,
    "vacuum_level": 0.23,
    "transfer_pressure": 0.12,
    "resin_batch_risk": 0.08,
    ...
}
```

The top entry = the "xxx parameter" (primary root cause).

### Identifying the Root Cause Stage

```python
STAGE_PARAMS = {
    'Die Bond': ['bond_force', 'xy_placement_offset', 'bond_line_thickness',
                 'epoxy_viscosity', 'pick_place_speed'],
    'Wire Bond': ['ultrasonic_power', 'bond_time', 'loop_height',
                  'capillary_stroke_count', 'efo_voltage'],
    'Mold': ['transfer_pressure', 'clamping_force', 'molding_temperature', 'vacuum_level'],
    'Ball Attach': ['ball_placement_accuracy', 'laser_pulse_energy',
                    'reflow_peak_temp', 'flux_density'],
    'Saw': ['spindle_current', 'vibration_amplitude', 'blade_wear_index', 'cooling_water_flow'],
}

def get_stage_attribution(sensitivities: dict) -> dict:
    """Sum sensitivities per stage."""
    stage_scores = {}
    for stage, params in STAGE_PARAMS.items():
        stage_scores[stage] = sum(sensitivities.get(p, 0) for p in params)
    return dict(sorted(stage_scores.items(), key=lambda x: x[1], reverse=True))
```

---

## Phase 4: 5-Stage Cumulative Lifecycle + JSON Output
**File**: `lifecycle.py`
**Time budget**: ~1.5 hours
**Purpose**: Run the ROM stage-by-stage, accumulating stress, and produce the final JSON for frontend.

### Core Function

```python
def compute_lifecycle(unit_params: dict, pod_modes, mean_field,
                      coeff_model, scaler) -> dict:
    """
    Compute the full lifecycle for a single unit.
    Returns a JSON-serializable dict for the frontend.
    """
    import time
    
    start = time.perf_counter()
    
    # --- Full ROM reconstruction ---
    alpha = predict_coefficients(unit_params, coeff_model, scaler)
    stress_field = mean_field + pod_modes @ alpha  # (2500,)
    stress_2d = stress_field.reshape(GRID_SIZE, GRID_SIZE)  # (50, 50)
    
    reconstruction_ms = (time.perf_counter() - start) * 1000
    
    # --- CRI per stage (reuse existing RRS logic) ---
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
    
    # --- Sensitivity / root cause ---
    sensitivities = compute_sensitivity(unit_params, pod_modes, mean_field,
                                         coeff_model, scaler)
    stage_attribution = get_stage_attribution(sensitivities)
    
    # --- Find the spike stage ---
    spike_stage_idx = int(np.argmax(rrs_deltas))
    stage_names = ['Die Bond', 'Wire Bond', 'Mold', 'Ball Attach', 'Saw']
    
    # --- Determine risk level ---
    final_cri = rrs_values[-1] if rrs_values else 0
    if final_cri >= 0.6:
        risk_level = "CRITICAL"
    elif final_cri >= 0.4:
        risk_level = "WARNING"
    else:
        risk_level = "HEALTHY"
    
    # --- Build output JSON ---
    return {
        "unit_id": unit_params.get('unit_id', 'UNKNOWN'),
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
            "primary_parameter": list(sensitivities.keys())[0],
            "primary_stage": list(stage_attribution.keys())[0],
        },
        
        "rom_metadata": {
            "reconstruction_time_ms": round(reconstruction_ms, 2),
            "pod_modes_used": pod_modes.shape[1],
            "grid_points": GRID_SIZE * GRID_SIZE,
        }
    }
```

---

## Phase 5: Demo Runner
**File**: `run_demo.py`
**Time budget**: ~1 hour (includes debugging)
**Purpose**: Tie everything together. Pick a few units, run the pipeline, dump JSON.

### Script Logic

```python
"""
ROM Digital Twin — Demo Runner
Usage: python run_demo.py
"""

# 1. Load ROM artifacts (pod_modes, mean_field, coeff_model)
# 2. Load a few units from the CSV (pick 1 healthy, 1 defective)
# 3. Run compute_lifecycle() on each
# 4. Save results to artifacts/demo_output.json
# 5. Print summary to console
```

### Expected Console Output

```
========================================
ROM DIGITAL TWIN — DEMO
========================================

Unit: UNIT_00012847  |  Bin: 5 (Defective)
  ROM Reconstruction: 8.3 ms
  Max Stress: 142.7 MPa
  Final CRI: 0.79  [CRITICAL]
  Spike Stage: Mold (+0.54)
  Root Cause: molding_temperature (42%), vacuum_level (23%)
  
Unit: UNIT_00098234  |  Bin: 1 (Healthy)
  ROM Reconstruction: 7.1 ms
  Max Stress: 38.2 MPa
  Final CRI: 0.14  [HEALTHY]
  Spike Stage: None (all deltas < 0.1)
  Root Cause: capillary_stroke_count (18%), blade_wear_index (15%)

JSON saved to artifacts/demo_output.json
========================================
```

---

## What-If Simulation (Bonus — if time permits)

Add to `lifecycle.py`:

```python
def simulate_what_if(unit_params, param_name, new_value, ...):
    """
    Re-run ROM with one parameter changed.
    Returns both original and simulated lifecycle for comparison.
    """
    original = compute_lifecycle(unit_params, ...)
    
    modified_params = unit_params.copy()
    modified_params[param_name] = new_value
    simulated = compute_lifecycle(modified_params, ...)
    
    return {
        "original": original,
        "simulated": simulated,
        "cri_change": simulated['cri_lifecycle']['cumulative_cri'][-1] -
                      original['cri_lifecycle']['cumulative_cri'][-1],
        "max_stress_change": simulated['stress_map']['max_stress_mpa'] -
                             original['stress_map']['max_stress_mpa'],
    }
```

---

## Execution Order (Build Sequence)

```
Step 1: config.py           — 15 min  — Define all constants and param lists
Step 2: stress_model.py     — 2 hrs   — Build and test the Gaussian stress generator
Step 3: build_rom.py        — 1.5 hrs — Snapshots + SVD + Ridge predictor
Step 4: sensitivity.py      — 1 hr    — Finite-difference sensitivity loop
Step 5: lifecycle.py         — 1.5 hrs — JSON output assembly
Step 6: run_demo.py         — 1 hr    — Integration + debugging
                              -------
                              ~7.5 hrs + buffer
```

## Acceptance Criteria (Prototype-Level)

- [ ] `stress_model.py`: Deterministic — same params always produce same 50×50 grid
- [ ] `stress_model.py`: Defective units produce visibly higher max stress than healthy
- [ ] `build_rom.py`: SVD captures ≥99% energy with k ≤ 20 modes
- [ ] `build_rom.py`: Reconstruction error < 5% on training snapshots
- [ ] `sensitivity.py`: Top root-cause parameter matches the defect archetype's root stage
- [ ] `lifecycle.py`: Output JSON matches the schema defined above
- [ ] `run_demo.py`: Reconstruction time < 50ms per unit
- [ ] All scripts run with only numpy, pandas, scikit-learn (no special dependencies)
