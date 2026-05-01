# TASK: Build generate_synthetic_data.py
## Executable Engineering Specification

> Reference: [FraudShieldAI/generate_synthetic_data.py](file:///c:/Users/chinp/OneDrive/Documents/VHack%20Referance/FraudShieldAI-Vhack2026/backend/generate_synthetic_data.py) (824 lines)
> Output: `MicronCaseStudy/generate_synthetic_data.py`

---

## OUTPUT FILES

```
data/machines.csv                        # Machine registry (mirrors accounts.csv)
data/synthetic_backend_assembly.csv      # 2M rows x 34+ features (single flat CSV)
```

---

## CONSTANTS

```python
TOTAL_UNITS    = 2_000_000
N_HEALTHY      = 1_840_000   # 92% yield
N_DEFECTIVE    = 160_000     # 8% scrap
RANDOM_SEED    = 42

# Bin distribution within N_HEALTHY
BIN_1_COUNT = 1_500_000  # 75% Prime
BIN_2_COUNT =   200_000  # 10% Speed Downgrade
BIN_3_COUNT =   140_000  #  7% Capacity Downgrade

# Bin distribution within N_DEFECTIVE
BIN_4_COUNT =  30_000    # 1.5% Logic/Fab Defect
BIN_5_COUNT =  30_000    # 1.5% High-Temp Fail
BIN_7_COUNT =  30_000    # 1.5% DC Gross Leakage
BIN_8_COUNT =  30_000    # 1.5% Open Circuit
BIN_9_COUNT =  20_000    # 1.0% Short Circuit
```

---

## STEP 1 — GENERATE MACHINE POOLS

Mirror FraudShieldAI's `generate_pool()` and `register_accounts()`.

```python
MACHINE_POOLS = {
    'die_bonder':   generate_pool('DB', 20),
    'wire_bonder':  generate_pool('WB', 40),
    'mold_press':   generate_pool('MP', 10),
    'ball_attach':  generate_pool('BA', 15),
    'saw':          generate_pool('SW', 8),
}

# Degraded subset (like HEAVY_MULES / REGULAR_MULES)
DEGRADED = {
    'die_bonder':   MACHINE_POOLS['die_bonder'][:3],
    'wire_bonder':  MACHINE_POOLS['wire_bonder'][:5],
    'mold_press':   MACHINE_POOLS['mold_press'][:2],
    'saw':          MACHINE_POOLS['saw'][:2],
}

RESIN_BATCHES     = [f'RESIN_{i:04d}' for i in range(50)]
BAD_RESIN_BATCHES = RESIN_BATCHES[:5]
```

Save `machines_registry` to `data/machines.csv` with columns:
`machine_id, machine_type, pool (healthy/degraded), stage, machine_risk_score`

---

## STEP 2 — DEFINE ARCHETYPES

### 2A: Healthy Archetypes (4 types)

Each archetype defines `{'mean': float, 'std': float}` per parameter per stage.

```python
HEALTHY_ARCHETYPES = {
    'nominal_optimal':     {'weight': 0.50, ...},  # Bin 1
    'nominal_edge':        {'weight': 0.25, ...},  # Bin 1 or 2
    'marginal_drift':      {'weight': 0.15, 'uses_degraded_machines': True, ...},  # Bin 1/2/3
    'batch_variation':     {'weight': 0.10, 'uses_bad_resin': 0.30, ...},  # Bin 1/2/3
}
```

**Bin assignment within healthy archetypes:**
- `nominal_optimal` → always Bin 1
- `nominal_edge` → 85% Bin 1, 15% Bin 2
- `marginal_drift` → 60% Bin 1, 25% Bin 2, 15% Bin 3
- `batch_variation` → 70% Bin 1, 20% Bin 2, 10% Bin 3

### 2B: Defect Archetypes (6 types)

```python
DEFECT_ARCHETYPES = {
    'void_delamination':     {'weight': 0.1875, 'target_bin': 7, 'root_stage': 1},
    'wire_non_stick':        {'weight': 0.1875, 'target_bin': 8, 'root_stage': 2},
    'mold_void_sweep':       {'weight': 0.1875, 'target_bins': [5,9], 'bin_weights': [0.6,0.4], 'root_stage': 3},
    'thermal_fracture':      {'weight': 0.1875, 'target_bin': 8, 'root_stage': 4},
    'ball_bridge_saw':       {'weight': 0.125,  'target_bin': 9, 'root_stage': 5},
    'fab_defect_passthrough':{'weight': 0.125,  'target_bin': 4, 'root_stage': 0},
}
# Weights sum to 1.0. Actual counts controlled by BIN_X_COUNT constants.
```

### 2C: Per-Stage Parameter Distributions

For EACH archetype, define all 22 parameters. Example for `void_delamination`:

```python
'void_delamination': {
    # Stage 1 — ROOT CAUSE (abnormal values)
    'stage1': {
        'bond_force':          {'mean': 22.0, 'std': 3.0},   # spec: 25-35, this is LOW
        'xy_placement_offset': {'mean': 12.0, 'std': 4.0},   # spec: 0-15, this is HIGH
        'bond_line_thickness': {'mean': 15.0, 'std': 3.0},   # spec: 18-32, this is LOW
        'epoxy_viscosity':     {'mean': 5000, 'std': 400},    # normal (process-level)
        'pick_place_speed':    {'mean': 8000, 'std': 500},    # normal
    },
    # Stages 2-5 — INHERIT NOMINAL (defect is latent, later stages look fine)
    'stage2': 'inherit_nominal_optimal',
    'stage3': 'inherit_nominal_optimal',
    'stage4': 'inherit_nominal_optimal',
    'stage5': 'inherit_nominal_optimal',
}
```

Key: when a stage says `'inherit_nominal_optimal'`, copy distributions from
`HEALTHY_ARCHETYPES['nominal_optimal']` for that stage. This mirrors FraudShieldAI's
fraud transactions having normal-looking features outside the attack vector.

---

## STEP 3 — PER-STAGE RRS FUNCTIONS

Write 5 separate functions. Each normalizes its stage's parameters into a 0-1 risk score.

```python
def compute_rrs_stage1(unit: dict) -> float:
    """Die Bond risk. Dominant signal: placement error + force deviation."""
    force_dev = abs(unit['bond_force'] - 30.0) / 5.0
    place_err = unit['xy_placement_offset'] / 15.0
    blt_dev   = abs(unit['bond_line_thickness'] - 25.0) / 7.0
    raw = force_dev * 0.40 + place_err * 0.35 + blt_dev * 0.25
    return np.clip(raw, 0.0, 1.0)

def compute_rrs_stage2(unit: dict) -> float:
    """Wire Bond risk. Dominant signal: capillary wear + power deviation."""
    power_dev = abs(unit['ultrasonic_power'] - 1.2) / 0.4
    time_dev  = abs(unit['bond_time'] - 15.0) / 5.0
    loop_dev  = abs(unit['loop_height'] - 200) / 50.0
    wear      = unit['capillary_stroke_count'] / 500_000
    raw = wear * 0.30 + power_dev * 0.30 + time_dev * 0.20 + loop_dev * 0.20
    return np.clip(raw, 0.0, 1.0)

def compute_rrs_stage3(unit: dict) -> float:
    """Mold risk. Dominant signal: vacuum quality + temperature deviation."""
    press_dev = abs(unit['transfer_pressure'] - 8.0) / 2.0
    vac_risk  = unit['vacuum_level'] / 10.0   # higher = worse vacuum
    temp_dev  = abs(unit['molding_temperature'] - 180) / 10.0
    resin_risk = unit.get('resin_batch_risk', 0.0)
    raw = vac_risk * 0.30 + temp_dev * 0.25 + press_dev * 0.25 + resin_risk * 0.20
    return np.clip(raw, 0.0, 1.0)

def compute_rrs_stage4(unit: dict) -> float:
    """Ball Attach risk. Dominant signal: thermal overshoot + placement."""
    temp_dev  = abs(unit['reflow_peak_temp'] - 260) / 10.0
    ball_err  = unit['ball_placement_accuracy'] / 25.0
    flux_dev  = abs(unit['flux_density'] - 0.8) / 0.3
    raw = temp_dev * 0.35 + ball_err * 0.35 + flux_dev * 0.30
    return np.clip(raw, 0.0, 1.0)

def compute_rrs_stage5(unit: dict) -> float:
    """Saw risk. Dominant signal: blade wear + vibration."""
    blade     = unit['blade_wear_index']
    vib_risk  = unit['vibration_amplitude'] / 1.5
    current_dev = abs(unit['spindle_current'] - 2.0) / 0.5
    raw = blade * 0.35 + vib_risk * 0.35 + current_dev * 0.30
    return np.clip(raw, 0.0, 1.0)
```

### Cumulative Stacking (shared formula after each stage):

```python
def compute_cumulative_rrs(prev_rrs: float, stage_rrs: float) -> float:
    interaction = prev_rrs * stage_rrs * 1.5
    cumulative = prev_rrs * 0.6 + stage_rrs * 0.3 + interaction * 0.1
    return np.clip(cumulative, 0.0, 1.0)
```

---

## STEP 4 — CORE RECORD GENERATION FUNCTION

Mirror FraudShieldAI's `generate_record(idx, is_fraud, archetype)`.

```python
def generate_record(idx: int, archetype: dict, is_defective: bool) -> dict:
    unit = {}
    unit['unit_id'] = f'UNIT_{idx:08d}'

    # 1. Assign machines (one per stage)
    #    If archetype has 'uses_degraded_machines', prefer DEGRADED pool
    unit['machine_db'] = pick_machine('die_bonder', archetype)
    unit['machine_wb'] = pick_machine('wire_bonder', archetype)
    unit['machine_mp'] = pick_machine('mold_press', archetype)
    unit['machine_ba'] = pick_machine('ball_attach', archetype)
    unit['machine_sw'] = pick_machine('saw', archetype)

    # 2. Assign resin batch
    if archetype.get('uses_bad_resin'):
        unit['resin_batch_id'] = np.random.choice(BAD_RESIN_BATCHES)
    else:
        unit['resin_batch_id'] = np.random.choice(RESIN_BATCHES)

    # 3. Generate Stage 1 parameters
    s1 = get_stage_params(archetype, 'stage1')
    unit['bond_force']          = np.random.normal(s1['bond_force']['mean'], s1['bond_force']['std'])
    unit['xy_placement_offset'] = abs(np.random.normal(s1['xy_placement_offset']['mean'], s1['xy_placement_offset']['std']))
    unit['bond_line_thickness'] = np.random.normal(s1['bond_line_thickness']['mean'], s1['bond_line_thickness']['std'])
    unit['epoxy_viscosity']     = np.random.normal(s1['epoxy_viscosity']['mean'], s1['epoxy_viscosity']['std'])
    unit['pick_place_speed']    = np.random.normal(s1['pick_place_speed']['mean'], s1['pick_place_speed']['std'])
    unit['rrs_1'] = compute_rrs_stage1(unit)

    # 4. Generate Stage 2 parameters
    s2 = get_stage_params(archetype, 'stage2')
    unit['ultrasonic_power']      = np.random.normal(...)
    unit['bond_time']             = np.random.normal(...)
    unit['loop_height']           = np.random.normal(...)
    unit['capillary_stroke_count']= sample_drift_value(archetype, ...)
    unit['efo_voltage']           = np.random.normal(...)
    unit['rrs_2'] = compute_cumulative_rrs(unit['rrs_1'], compute_rrs_stage2(unit))

    # 5. Generate Stage 3 parameters
    # ... same pattern ...
    unit['rrs_3'] = compute_cumulative_rrs(unit['rrs_2'], compute_rrs_stage3(unit))

    # 6. Generate Stage 4 parameters
    unit['rrs_4'] = compute_cumulative_rrs(unit['rrs_3'], compute_rrs_stage4(unit))

    # 7. Generate Stage 5 parameters
    unit['rrs_5'] = compute_cumulative_rrs(unit['rrs_4'], compute_rrs_stage5(unit))

    # 8. Stage deltas
    unit['rrs_delta_1'] = unit['rrs_1']
    unit['rrs_delta_2'] = unit['rrs_2'] - unit['rrs_1']
    unit['rrs_delta_3'] = unit['rrs_3'] - unit['rrs_2']
    unit['rrs_delta_4'] = unit['rrs_4'] - unit['rrs_3']
    unit['rrs_delta_5'] = unit['rrs_5'] - unit['rrs_4']

    # 9. Assign bin_code (from archetype definition)
    unit['bin_code'] = assign_bin(archetype, is_defective)

    # 10. Placeholders for post-hoc derived features
    unit['machine_risk_score']     = None  # filled in Step 7
    unit['resin_batch_risk_score'] = None  # filled in Step 7

    return unit
```

---

## STEP 5 — GENERATE ALL 2M RECORDS

Mirror FraudShieldAI's Step 6.

```python
records = []

# Healthy units
healthy_choices = np.random.choice(
    list(HEALTHY_ARCHETYPES.keys()),
    size=N_HEALTHY,
    p=[a['weight'] for a in HEALTHY_ARCHETYPES.values()]
)
for i in range(N_HEALTHY):
    archetype = HEALTHY_ARCHETYPES[healthy_choices[i]]
    records.append(generate_record(i, archetype, is_defective=False))

# Defective units — controlled by BIN counts, NOT archetype weights
# Generate exact counts per target bin
defect_idx = N_HEALTHY
for arch_name, arch in DEFECT_ARCHETYPES.items():
    # Calculate how many units this archetype produces
    count = calculate_defect_count(arch)  # based on BIN_X_COUNT
    for i in range(count):
        records.append(generate_record(defect_idx + i, arch, is_defective=True))
    defect_idx += count

df = pd.DataFrame(records)
```

---

## STEP 6 — COMPUTE MACHINE RISK SCORE (Post-Hoc Derived Feature)

Mirror FraudShieldAI's Step 7 (recipient_risk_profile_score).

For each machine, aggregate stats from all units that passed through it:

```python
for stage_col in ['machine_db', 'machine_wb', 'machine_mp', 'machine_ba', 'machine_sw']:
    machine_stats = df.groupby(stage_col).agg(
        total_units      = ('unit_id', 'count'),
        defect_rate      = ('is_defective', 'mean'),    # is_defective = bin_code >= 4
        avg_rrs          = ('rrs_5', 'mean'),
        max_rrs          = ('rrs_5', 'max'),
    ).reset_index()

    # Weighted machine risk (like recipient_risk_profile_score formula)
    machine_stats['risk'] = (
        machine_stats['defect_rate'] * 0.40 +
        machine_stats['avg_rrs']     * 0.35 +
        machine_stats['max_rrs']     * 0.25
    ).clip(0, 1).round(3)

    # Map back to df
    # ...
```

Combine all 5 per-stage machine risks into single `machine_risk_score`:
```python
df['machine_risk_score'] = (
    df['machine_db_risk'] * 0.25 +
    df['machine_wb_risk'] * 0.25 +
    df['machine_mp_risk'] * 0.20 +
    df['machine_ba_risk'] * 0.15 +
    df['machine_sw_risk'] * 0.15
).round(3)
```

Similarly compute `resin_batch_risk_score` from resin batch defect rates.

---

## STEP 7 — INJECT NOISE (Mirrors FraudShieldAI Fixes 1-3)

### Fix 1: Healthy units on degraded machines (8% of healthy)
```python
noise_idx = df[df['is_defective']==False].sample(frac=0.08).index
# For these units, reassign machine_db/wb/mp to DEGRADED pool
# Their raw parameters stay healthy, but machine_risk_score gets elevated
```

### Fix 2: Gaussian noise on machine_risk_score
```python
# Healthy machine noise: N(0, 0.05)
# Degraded machine noise: N(-0.03, 0.06)
# Creates overlap zone so model can't perfectly separate on this feature
```

### Fix 3: Edge cases (8% of all units)
```python
n_noise = int(len(df) * 0.08)
noise_idx = df.sample(n_noise).index
third = n_noise // 3

# Edge 1: Marginal pass — healthy unit, 2+ params near spec limits
# Edge 2: Latent defect — defective unit, all nominal raw params (like fab_passthrough)
# Edge 3: Tool recovery — unit on recently-serviced machine, history looks bad but unit is fine
```

---

## STEP 8 — SHUFFLE AND ENFORCE COLUMN ORDER

```python
df = df.sample(frac=1, random_state=42).reset_index(drop=True)

FINAL_COLUMNS = [
    'unit_id',
    # Stage 1
    'bond_force', 'xy_placement_offset', 'bond_line_thickness',
    'epoxy_viscosity', 'pick_place_speed',
    # Stage 2
    'ultrasonic_power', 'bond_time', 'loop_height',
    'capillary_stroke_count', 'efo_voltage',
    # Stage 3
    'transfer_pressure', 'clamping_force', 'molding_temperature',
    'vacuum_level', 'resin_batch_id',
    # Stage 4
    'ball_placement_accuracy', 'laser_pulse_energy',
    'reflow_peak_temp', 'flux_density',
    # Stage 5
    'spindle_current', 'vibration_amplitude',
    'blade_wear_index', 'cooling_water_flow',
    # Cumulative RRS
    'rrs_1', 'rrs_2', 'rrs_3', 'rrs_4', 'rrs_5',
    'rrs_delta_1', 'rrs_delta_2', 'rrs_delta_3', 'rrs_delta_4', 'rrs_delta_5',
    # Derived scores
    'machine_risk_score', 'resin_batch_risk_score',
    # Machine IDs (for debugging, dropped before training)
    'machine_db', 'machine_wb', 'machine_mp', 'machine_ba', 'machine_sw',
    # Target
    'bin_code',
]
```

---

## STEP 9 — SANITY CHECKS

Print and verify (mirrors FraudShieldAI's Step 11):

```
1. Total records: 2,000,000
2. Bin distribution matches target percentages
3. Defective vs healthy counts correct
4. Per-stage RRS: defective units should have higher avg RRS at root_cause_stage
5. machine_risk_score overlap zone exists (healthy and degraded machines overlap)
6. Top correlations with bin_code
7. RRS_5 distribution: defective avg >> healthy avg
8. Edge case injection counts
9. No impossible values (e.g., negative bond_force)
```

---

## STEP 10 — SAVE

```python
df[FINAL_COLUMNS].to_csv('data/synthetic_backend_assembly.csv', index=False)
df_machines.to_csv('data/machines.csv', index=False)
```

---

## ACCEPTANCE CRITERIA

- [ ] Runs end-to-end with `python generate_synthetic_data.py`
- [ ] Produces exactly 2,000,000 rows
- [ ] Bin distribution within 0.1% of targets
- [ ] All 22 raw features have realistic ranges (no values outside physical limits)
- [ ] RRS scores are 0-1, cumulative stacking is visible (rrs_5 > rrs_1 for most units)
- [ ] machine_risk_score has overlap zone between healthy and degraded machines
- [ ] Sanity check printout shows all metrics in expected ranges
- [ ] File size is reasonable (~400-600 MB for 2M rows)
- [ ] Random seed 42 produces deterministic output
