# PROJECT AETERNUM — Tri-Shield ML Implementation Plan
## Cumulative Digital Twin for Semiconductor Backend Assembly

> Adapted from FraudShieldAI VHack 2026 methodology

---

## 1. Concept Mapping: FraudShieldAI → Aeternum

| FraudShieldAI Concept | Aeternum Equivalent |
|---|---|
| Transaction | A single Unit_ID passing through all 5 stages |
| `is_fraud` (binary label) | `bin_code` (multiclass: Bin 1–8) |
| Fraud archetypes (account_takeover, mule, etc.) | **Defect archetypes** (void_delamination, wire_non_stick, mold_void, etc.) |
| Legit archetypes (migrant_worker, elderly, etc.) | **Healthy archetypes** (nominal_fast, nominal_slow, marginal_drift, etc.) |
| `recipient_risk_profile_score` (derived feature) | **Cumulative RRS** (Reliability Risk Score — updates per stage) |
| Account pools (fraud senders, mule recipients) | **Machine pools** (healthy machines, drifting machines, degraded machines) |
| Noise injection (Fix 1-3, edge cases) | **Process noise** (tool drift, batch effects, ambient shifts) |
| Ensemble: LGB + IsoForest + Behavioral | Ensemble: LGB + IsoForest + **Physics Rules** |
| SHAP per-feature explanation | SHAP per-feature + **stage attribution** (which stage caused failure) |

---

## 2. Data Generation Architecture

### 2.1 Scale and Class Distribution

```
TOTAL_UNITS       = 2,000,000  (matches FraudShieldAI scale)
YIELD_TARGET      = 92%  (industry realistic for backend assembly)

Bin 1 (Prime):              75%  = 1,500,000 units
Bin 2 (Speed Downgrade):    10%  =   200,000
Bin 3 (Capacity Downgrade):  7%  =   140,000
--- Sellable total: 92% ---
Bin 4 (Logic/Fab Defect):    1.5% =  30,000  (not packaging-caused)
Bin 5 (High-Temp Fail):      1.5% =  30,000  (Stage 3 mold voids)
Bin 6 (DC Gross Leakage):    1.5% =  30,000  (Stage 1 die bond cracks)
Bin 7 (Open Circuit):        1.5% =  30,000  (Stage 2/4 wire issues)
Bin 8 (Short Circuit):       1.0% =  20,000  (Stage 3/5 bridging)
--- Scrap total: 8% = 160,000 units ---
```

### 2.2 Machine and Tool Pools (Mirrors FraudShieldAI Account Pools)

```python
# Like FraudShieldAI's generate_pool('C', 500, used_ids)
MACHINE_POOLS = {
    'die_bonder':    generate_pool('DB', 20),   # 20 die bond machines
    'wire_bonder':   generate_pool('WB', 40),   # 40 wire bonders
    'mold_press':    generate_pool('MP', 10),   # 10 mold presses
    'ball_attach':   generate_pool('BA', 15),   # 15 ball attach tools
    'saw':           generate_pool('SW', 8),    # 8 saw singulation tools
}

# Like FraudShieldAI's MULE_POOL — some machines are degraded
DEGRADED_MACHINES = {
    'die_bonder':  MACHINE_POOLS['die_bonder'][:3],   # 3 drifting die bonders
    'wire_bonder': MACHINE_POOLS['wire_bonder'][:5],   # 5 aging wire bonders
    'mold_press':  MACHINE_POOLS['mold_press'][:2],    # 2 poorly-maintained presses
    'saw':         MACHINE_POOLS['saw'][:2],            # 2 worn-blade saws
}

RESIN_BATCHES = [f'RESIN_{i:04d}' for i in range(50)]  # 50 resin batches
BAD_RESIN_BATCHES = RESIN_BATCHES[:5]                    # 5 problematic batches
```

### 2.3 Stage Input Parameters (From Your Diagram)

#### Stage 1 — Die Bond
| Parameter | Type | Unit | Nominal | Spec Range |
|---|---|---|---|---|
| `bond_force` | Unit | N | 30.0 | 25-35 |
| `xy_placement_offset` | Unit | um | 0.0 | 0-15 (Euclidean) |
| `bond_line_thickness` | Unit | um | 25.0 | 18-32 |
| `epoxy_viscosity` | Process | cP | 5000 | 4000-6000 |
| `pick_place_speed` | Process | units/hr | 8000 | 6000-10000 |

#### Stage 2 — Wire Bond
| Parameter | Type | Unit | Nominal | Spec Range |
|---|---|---|---|---|
| `ultrasonic_power` | Unit | W | 1.2 | 0.8-1.6 |
| `bond_time` | Unit | ms | 15.0 | 10-20 |
| `loop_height` | Unit | um | 200 | 150-250 |
| `capillary_stroke_count` | Drift | count | 0 | 0-500000 |
| `efo_voltage` | Process | V | 4000 | 3500-4500 |

#### Stage 3 — Mold
| Parameter | Type | Unit | Nominal | Spec Range |
|---|---|---|---|---|
| `transfer_pressure` | Unit | MPa | 8.0 | 6-10 |
| `clamping_force` | Unit | kN | 50 | 40-60 |
| `molding_temperature` | Process | C | 180 | 170-190 |
| `vacuum_level` | Process | mbar | 5.0 | 1-10 |
| `resin_batch_id` | Process | categorical | - | 50 batches |

#### Stage 4 — Ball Attach and Laser Mark
| Parameter | Type | Unit | Nominal | Spec Range |
|---|---|---|---|---|
| `ball_placement_accuracy` | Unit | um | 0.0 | 0-25 (offset) |
| `laser_pulse_energy` | Unit | mJ | 0.5 | 0.3-0.7 |
| `reflow_peak_temp` | Process | C | 260 | 250-270 |
| `flux_density` | Process | mg/cm2 | 0.8 | 0.5-1.1 |

#### Stage 5 — Saw Singulation
| Parameter | Type | Unit | Nominal | Spec Range |
|---|---|---|---|---|
| `spindle_current` | Unit | A | 2.0 | 1.5-2.5 |
| `vibration_amplitude` | Unit | G | 0.5 | 0-1.5 |
| `blade_wear_index` | Drift | normalized | 0.0 | 0.0-1.0 |
| `cooling_water_flow` | Process | L/min | 1.5 | 1.0-2.0 |

**Total: 23 raw features across 5 stages** (+ derived cumulative features)

---

## 3. Archetype System (Mirrors FraudShieldAI Exactly)

### 3.1 Healthy Archetypes (Like LEGIT_ARCHETYPES)

```python
HEALTHY_ARCHETYPES = {

    'nominal_optimal': {
        'weight': 0.50,  # 50% of healthy units
        'description': 'Everything near center of spec',
        'stage1': {
            'bond_force':          {'mean': 30.0, 'std': 1.0},
            'xy_placement_offset': {'mean': 3.0,  'std': 1.5},
            'bond_line_thickness': {'mean': 25.0, 'std': 1.5},
        },
        'stage2': {
            'ultrasonic_power':     {'mean': 1.2, 'std': 0.05},
            'bond_time':            {'mean': 15,  'std': 1.0},
            'loop_height':          {'mean': 200, 'std': 10},
        },
        # ... all stages defined with tight distributions
    },

    'nominal_edge_of_spec': {
        'weight': 0.25,  # 25% — slightly off-center but still good
        'description': 'Parameters near spec limits but within tolerance',
        'stage1': {
            'bond_force':          {'mean': 27.0, 'std': 1.5},  # low side
            'xy_placement_offset': {'mean': 8.0,  'std': 3.0},  # higher offset
            'bond_line_thickness': {'mean': 22.0, 'std': 2.0},  # thin side
        },
        # ...
    },

    'marginal_drift': {
        'weight': 0.15,  # 15% — machine is drifting but parts still pass
        'description': 'Gradual tool wear causing parameter drift',
        'uses_degraded_machines': True,
        # Parameters have wider std and shifted means
    },

    'batch_variation': {
        'weight': 0.10,  # 10% — resin/material batch effects
        'description': 'Normal variation from material lot changes',
        'resin_batch_effect': True,
        # Mold stage parameters shift based on resin batch
    },
}
```

### 3.2 Defect Archetypes (Like FRAUD_ARCHETYPES)

```python
DEFECT_ARCHETYPES = {

    'void_delamination': {
        'weight': 0.25,  # maps to Bin 6 (DC Gross Leakage)
        'target_bin': 6,
        'root_cause_stage': 1,  # Die Bond
        'description': 'Epoxy void or delamination from die bond issues',
        'stage1': {
            'bond_force':          {'mean': 22.0, 'std': 3.0},   # too low
            'xy_placement_offset': {'mean': 12.0, 'std': 4.0},   # misaligned
            'bond_line_thickness': {'mean': 15.0, 'std': 3.0},   # too thin
        },
        'stage2': 'inherit_nominal',  # Stage 2 looks normal
        'stage3': 'inherit_nominal',  # Stage 3 looks normal
        # The defect is latent from Stage 1 — only visible in Final Test
    },

    'wire_non_stick': {
        'weight': 0.25,  # maps to Bin 7 (Open Circuit)
        'target_bin': 7,
        'root_cause_stage': 2,  # Wire Bond
        'description': 'Wire bond non-stick or lift-off',
        'stage1': 'inherit_nominal',
        'stage2': {
            'ultrasonic_power':       {'mean': 0.85, 'std': 0.1},  # too low
            'bond_time':              {'mean': 11,   'std': 1.5},  # too short
            'loop_height':            {'mean': 240,  'std': 15},   # too high
            'capillary_stroke_count': {'mean': 350000, 'std': 50000}, # worn
        },
    },

    'mold_void_wire_sweep': {
        'weight': 0.20,  # maps to Bin 5 (High-Temp) or Bin 8 (Short)
        'target_bins': [5, 8],
        'target_bin_weights': [0.6, 0.4],
        'root_cause_stage': 3,  # Mold
        'stage3': {
            'transfer_pressure':   {'mean': 9.5,  'std': 0.5},  # too high
            'vacuum_level':        {'mean': 8.0,  'std': 1.5},  # poor vacuum
            'molding_temperature': {'mean': 188,  'std': 3.0},  # too hot
        },
        'uses_bad_resin': True,  # preferentially uses BAD_RESIN_BATCHES
    },

    'thermal_fracture': {
        'weight': 0.15,  # maps to Bin 7 (Open Circuit)
        'target_bin': 7,
        'root_cause_stage': 4,  # Ball Attach
        'stage4': {
            'reflow_peak_temp':       {'mean': 268, 'std': 3.0},  # too hot
            'ball_placement_accuracy': {'mean': 18,  'std': 5.0},  # misaligned
        },
    },

    'ball_bridge_saw_damage': {
        'weight': 0.10,  # maps to Bin 8 (Short Circuit)
        'target_bin': 8,
        'root_cause_stage': 5,  # Saw or Ball Attach
        'stage4': {
            'ball_placement_accuracy': {'mean': 20, 'std': 5.0},  # offset
            'flux_density':            {'mean': 1.05, 'std': 0.1}, # excess
        },
        'stage5': {
            'spindle_current':      {'mean': 2.4, 'std': 0.2},  # high
            'vibration_amplitude':  {'mean': 1.2, 'std': 0.3},  # excessive
            'blade_wear_index':     {'mean': 0.85, 'std': 0.1}, # worn blade
        },
    },

    'fab_defect_passthrough': {
        'weight': 0.05,  # maps to Bin 4 (Logic Failure — fab, not packaging)
        'target_bin': 4,
        'root_cause_stage': 0,  # Pre-existing silicon defect
        # ALL stages look perfectly nominal — defect is invisible to packaging
        'all_stages': 'inherit_nominal',
    },
}
```

**KEY INSIGHT:** Like FraudShieldAI where some fraud transactions have clean IPs (sophisticated fraudster edge case), the `fab_defect_passthrough` archetype has **perfectly normal packaging parameters** but still fails. This forces the model to learn that not all failures are predictable from packaging data alone.

---

## 4. Cumulative RRS — The Core Differentiator

### 4.1 Concept (Mirrors recipient_risk_profile_score)

In FraudShieldAI, `recipient_risk_profile_score` is a derived feature computed from aggregate transaction behavior. In Aeternum, the **Cumulative Reliability Risk Score (RRS)** is computed after each stage:

```
RRS_after_stage_1 = f(Stage 1 features)
RRS_after_stage_2 = f(Stage 1 features, Stage 2 features, RRS_1)
RRS_after_stage_3 = f(Stage 1-2 features, Stage 3 features, RRS_2)
RRS_after_stage_4 = f(Stage 1-3 features, Stage 4 features, RRS_3)
RRS_after_stage_5 = f(Stage 1-4 features, Stage 5 features, RRS_4)  <- FINAL
```

### 4.2 RRS Computation (Per Stage)

Each stage has its **own** `compute_rrs_stageN()` function with different parameters and weights. These are **predefined physics-based formulas** — not learned from data. They normalize each stage's raw parameters into a 0–1 risk score.

#### Summary Table

| Stage | Function | Input Parameters | Normalization | Weights | Dominant Signal |
|-------|----------|-----------------|---------------|---------|-----------------|
| 1 (Die Bond) | `compute_rrs_stage1()` | `bond_force`, `xy_placement_offset`, `bond_line_thickness` | `abs(val - nominal) / half_range` | 0.40, 0.35, 0.25 | Force deviation (0.40) |
| 2 (Wire Bond) | `compute_rrs_stage2()` | `ultrasonic_power`, `bond_time`, `loop_height`, `capillary_stroke_count` | `abs(val - nominal) / half_range`; wear = `count / max_life` | 0.30, 0.30, 0.20, 0.20 | Capillary wear + power (0.30 each) |
| 3 (Mold) | `compute_rrs_stage3()` | `transfer_pressure`, `vacuum_level`, `molding_temperature`, `resin_batch_risk` | `abs(val - nominal) / half_range`; vacuum = `val / max` | 0.30, 0.25, 0.25, 0.20 | Vacuum quality (0.30) |
| 4 (Ball Attach) | `compute_rrs_stage4()` | `reflow_peak_temp`, `ball_placement_accuracy`, `flux_density` | `abs(val - nominal) / half_range`; placement = `val / max_spec` | 0.35, 0.35, 0.30 | Thermal overshoot + placement (0.35 each) |
| 5 (Saw) | `compute_rrs_stage5()` | `blade_wear_index`, `vibration_amplitude`, `spindle_current` | wear = raw (already 0–1); vibration = `val / max`; current = `abs(val - nom) / range` | 0.35, 0.35, 0.30 | Blade wear + vibration (0.35 each) |

#### All 5 Stage Functions

```python
def compute_rrs_stage1(unit: dict) -> float:
    """Die Bond risk. Uses only Unit-level features from Stage 1.
    Normalization: deviation from nominal / half of spec range.
    bond_force nominal=30, spec 25-35, so half_range=5.
    xy_offset nominal=0, spec 0-15, so max=15.
    BLT nominal=25, spec 18-32, so half_range=7.
    """
    force_dev = abs(unit['bond_force'] - 30.0) / 5.0
    place_err = unit['xy_placement_offset'] / 15.0
    blt_dev   = abs(unit['bond_line_thickness'] - 25.0) / 7.0
    raw = force_dev * 0.40 + place_err * 0.35 + blt_dev * 0.25
    return np.clip(raw, 0.0, 1.0)


def compute_rrs_stage2(unit: dict) -> float:
    """Wire Bond risk. Includes drift feature (capillary_stroke_count).
    Normalization: deviation / half_range for continuous params.
    capillary_stroke_count: 0 = new tool, 500K = end of life → linear 0-1.
    """
    power_dev = abs(unit['ultrasonic_power'] - 1.2) / 0.4
    time_dev  = abs(unit['bond_time'] - 15.0) / 5.0
    loop_dev  = abs(unit['loop_height'] - 200) / 50.0
    wear      = unit['capillary_stroke_count'] / 500_000
    raw = wear * 0.30 + power_dev * 0.30 + time_dev * 0.20 + loop_dev * 0.20
    return np.clip(raw, 0.0, 1.0)


def compute_rrs_stage3(unit: dict) -> float:
    """Mold risk. Includes resin batch risk (post-hoc derived feature).
    vacuum_level: lower = better vacuum. 1 mbar = ideal, 10 = poor.
    Normalized as val/10 so higher = worse.
    """
    press_dev  = abs(unit['transfer_pressure'] - 8.0) / 2.0
    vac_risk   = unit['vacuum_level'] / 10.0
    temp_dev   = abs(unit['molding_temperature'] - 180) / 10.0
    resin_risk = unit.get('resin_batch_risk', 0.0)
    raw = vac_risk * 0.30 + temp_dev * 0.25 + press_dev * 0.25 + resin_risk * 0.20
    return np.clip(raw, 0.0, 1.0)


def compute_rrs_stage4(unit: dict) -> float:
    """Ball Attach risk. Thermal overshoot is the primary concern.
    reflow_peak_temp nominal=260, spec 250-270, half_range=10.
    ball_placement_accuracy: 0 = perfect, 25 = max spec.
    flux_density nominal=0.8, spec 0.5-1.1, half_range=0.3.
    """
    temp_dev = abs(unit['reflow_peak_temp'] - 260) / 10.0
    ball_err = unit['ball_placement_accuracy'] / 25.0
    flux_dev = abs(unit['flux_density'] - 0.8) / 0.3
    raw = temp_dev * 0.35 + ball_err * 0.35 + flux_dev * 0.30
    return np.clip(raw, 0.0, 1.0)


def compute_rrs_stage5(unit: dict) -> float:
    """Saw Singulation risk. Includes drift feature (blade_wear_index).
    blade_wear_index: already 0-1 (0=new, 1=end of life).
    vibration_amplitude: 0 = no vibration, 1.5G = max safe.
    spindle_current nominal=2.0A, spec 1.5-2.5, half_range=0.5.
    """
    blade       = unit['blade_wear_index']
    vib_risk    = unit['vibration_amplitude'] / 1.5
    current_dev = abs(unit['spindle_current'] - 2.0) / 0.5
    raw = blade * 0.35 + vib_risk * 0.35 + current_dev * 0.30
    return np.clip(raw, 0.0, 1.0)
```

#### Cumulative Stacking Formula (Shared Across All Stages)

After each stage's own RRS is computed, it is folded into the running cumulative score using this **tolerance stacking** equation:

```python
def compute_cumulative_rrs(prev_rrs: float, stage_rrs: float) -> float:
    """
    Combines the previous cumulative RRS with the current stage's RRS.
    The interaction term is the key — it makes two small deviations
    compound into disproportionate risk (tolerance stacking).

    Components:
      prev_rrs  * 0.6  → inherited stress from all previous stages (60% weight)
      stage_rrs * 0.3  → new stress from this stage (30% weight)
      interaction * 0.1 → compounding penalty (10% weight, amplified by 1.5x)

    Example:
      prev_rrs=0.3, stage_rrs=0.3 → interaction=0.3*0.3*1.5=0.135
      cumulative = 0.3*0.6 + 0.3*0.3 + 0.135*0.1 = 0.18 + 0.09 + 0.0135 = 0.2835

      prev_rrs=0.7, stage_rrs=0.7 → interaction=0.7*0.7*1.5=0.735
      cumulative = 0.7*0.6 + 0.7*0.3 + 0.735*0.1 = 0.42 + 0.21 + 0.0735 = 0.7035
      (high prev + high current → risk accelerates)
    """
    interaction = prev_rrs * stage_rrs * 1.5
    cumulative = prev_rrs * 0.6 + stage_rrs * 0.3 + interaction * 0.1
    return np.clip(cumulative, 0.0, 1.0)
```

#### How It's Applied In `generate_record()`

```
rrs_1 = compute_rrs_stage1(unit)                          # Stage 1 standalone
rrs_2 = compute_cumulative_rrs(rrs_1, compute_rrs_stage2(unit))  # Stack on Stage 1
rrs_3 = compute_cumulative_rrs(rrs_2, compute_rrs_stage3(unit))  # Stack on 1+2
rrs_4 = compute_cumulative_rrs(rrs_3, compute_rrs_stage4(unit))  # Stack on 1+2+3
rrs_5 = compute_cumulative_rrs(rrs_4, compute_rrs_stage5(unit))  # FINAL cumulative
```

### 4.3 Final Feature Vector Per Unit

After all 5 stages, each unit has:

```
23 raw features (from stages 1-5)
 5 per-stage RRS scores (rrs_1 through rrs_5)
 5 stage_rrs_delta values (how much risk increased at each stage)
 1 machine_risk_score (aggregate risk of the machines used)
 1 resin_batch_risk_score (batch effect)
-- Total: 34 features + bin_code target --
```

---

## 5. Noise and Edge Case Injection (Mirrors FraudShieldAI Fixes 1-3)

### Fix 1 — Healthy Units on Degraded Machines

Like FraudShieldAI routing 10% of legit transactions to mule accounts:

```python
# 8% of healthy units are processed on degraded machines
# They still pass, but their machine_risk_score will be elevated
# Prevents model from using machine_risk_score as a perfect separator
```

### Fix 2 — Gaussian Noise on Machine Risk Score

Like FraudShieldAI's noise injection on recipient_risk_profile_score:

```python
# Add noise to machine_risk_score to create overlap zone
# Healthy machine noise: N(0, 0.05) — some healthy machines look risky
# Degraded machine noise: N(-0.03, 0.06) — some bad machines look clean
```

### Fix 3 — Edge Cases (approx 8% of all units)

| Edge Case | Mirrors FraudShieldAI | Effect |
|---|---|---|
| **Marginal pass** | Migrant worker FP | Healthy unit with 2+ params near spec limits — looks suspicious but passes |
| **Latent defect** | Sophisticated fraudster | Defective unit with all-nominal raw features — defect only shows in test |
| **Tool recovery** | New legit user | Machine was degraded but serviced — recent units fine but history bad |

---

## 6. Tri-Shield Model Architecture

### Shield 1: LightGBM (Supervised) — Multiclass

```python
LGBMClassifier(
    objective='multiclass',      # NOT binary like FraudShieldAI
    num_class=8,                 # Bins 1-8
    n_estimators=500,
    learning_rate=0.05,
    max_depth=8,                 # deeper than fraud (more complex patterns)
    num_leaves=127,
    class_weight='balanced',     # handles imbalance instead of SMOTE
    eval_metric='multi_logloss',
)
```

Key difference: Output is 8 class probabilities. The risk score becomes `1 - P(Bin 1)`.

### Shield 2: Isolation Forest (Unsupervised) — Anomaly Detection

```python
IsolationForest(
    contamination=0.08,          # 8% expected defect rate
    n_estimators=200,
    max_samples=512,
    max_features=0.5,
)
```

Identical concept to FraudShieldAI. Catches novel failure modes unseen by supervised model.

### Shield 3: Physics Rules (Domain Expert) — Replaces Behavioral

Same architecture as FraudShieldAI behavioral rules (4 rules, weighted to 1.0, based on pure domain knowledge), but using **semiconductor physics** instead of fraud behavior:

| Rule | Weight | Logic | Physics Rationale |
|------|--------|-------|-------------------|
| `tolerance_stack_violation` | **0.30** | `rrs_5 > 0.6` OR (`rrs_delta` at any stage > 0.3) | A unit that accumulated stress across multiple stages — even if each stage was "within spec", the **combination** crosses the failure threshold. |
| `thermal_stress_indicator` | **0.25** | `abs(molding_temp - 180)/10 × 0.4 + abs(reflow_temp - 260)/10 × 0.4 + (blade_wear × vibration) × 0.2` | Excessive heat at Stage 3 or Stage 4 causes material degradation. Combined with mechanical stress at Stage 5, it creates thermal fatigue cracks. |
| `mechanical_stress_indicator` | **0.25** | `(bond_force < 25) × 0.3 + (xy_offset > 10) × 0.3 + (vibration > 1.0) × 0.2 + (spindle_current > 2.3) × 0.2` | Physical forces outside safe envelope — low bond force = delamination risk, high vibration = chipping, high spindle current = blade dragging. |
| `drift_aging_indicator` | **0.20** | `capillary_stroke_count/500000 × 0.5 + blade_wear_index × 0.5` | Tool wear is a known root cause of gradual quality degradation. A worn capillary makes weak wire bonds; a worn blade causes chipping. |

```python
PHYSICS_RULES = {
    'tolerance_stack_violation':  0.30,
    'thermal_stress_indicator':   0.25,
    'mechanical_stress_indicator': 0.25,
    'drift_aging_indicator':      0.20,
}
```

---

## 7. Ensemble Fusion (Identical Methodology)

```python
# Weights found via grid search on validation set (same as FraudShieldAI)
final_risk = lgb_risk * w_lgb + iso_risk * w_iso + physics_risk * w_physics

# Threshold tuning via PR curve on validation set
# Multiclass adaptation: threshold for "sellable vs scrap"
# P(Bin 1 + Bin 2 + Bin 3) vs P(Bin 4-9)
```

---

## 8. SHAP Analysis (Enhanced With Stage Attribution)

### 8.1 Per-Feature SHAP (Same as FraudShieldAI)

```python
explainer = shap.TreeExplainer(lgb_model)
shap_values = explainer(X_unit)  # per-feature contributions
```

### 8.2 Stage Attribution (New for Aeternum)

Group SHAP values by manufacturing stage:

```python
stage_attribution = {
    'Stage 1 (Die Bond)':     sum(SHAP for bond_force, xy_offset, blt, ...),
    'Stage 2 (Wire Bond)':    sum(SHAP for ultrasonic_power, bond_time, ...),
    'Stage 3 (Mold)':         sum(SHAP for transfer_pressure, vacuum, ...),
    'Stage 4 (Ball Attach)':  sum(SHAP for ball_accuracy, reflow_temp, ...),
    'Stage 5 (Saw)':          sum(SHAP for spindle_current, vibration, ...),
    'Cumulative RRS':         sum(SHAP for rrs_1 through rrs_5),
    'IsoForest Anomaly':      iso_score * w_iso,   # proxy bar
    'Physics Rules':          physics_score * w_physics,  # proxy bar
}
```

This tells the engineer: **"Stage 3 contributed 62% of the risk for this unit"** — directly actionable.

---

## 9. File Structure

```
MicronCaseStudy/
├── implementation_plan.md         # THIS FILE
├── generate_synthetic_data.py     # 500K units, archetype-based
├── data/
│   ├── machines.csv               # machine registry (mirrors accounts.csv)
│   └── synthetic_backend_assembly.csv
├── models/
│   ├── supervised/                # LightGBM multiclass
│   │   ├── preprocessing.py
│   │   ├── model.py
│   │   └── train.py
│   ├── unsupervised/
│   │   └── isolation_forest/
│   └── ensemble/
│       ├── physics_rules.py       # replaces behavioral
│       ├── score_fusion.py        # grid search weights + threshold
│       └── run_ensemble.py
├── api/
│   ├── main.py                    # FastAPI endpoints
│   ├── inference.py               # EnsembleEngine
│   └── schemas.py
└── evaluate_model.py              # Graphs + stage attribution plots
```

---

## 10. Implementation Order

| Phase | Task | Mirrors FraudShieldAI |
|-------|------|----------------------|
| **1** | `generate_synthetic_data.py` — machine pools, archetypes, RRS, noise | `generate_synthetic_data.py` |
| **2** | `models/supervised/` — LightGBM multiclass pipeline | `models/supervised/` |
| **3** | `models/unsupervised/` — Isolation Forest pipeline | `models/unsupervised/` |
| **4** | `models/ensemble/physics_rules.py` — physics-informed rules | `api/behavioural.py` |
| **5** | `score_fusion.py` + `run_ensemble.py` — weight/threshold tuning | `models/ensemble/` |
| **6** | `api/inference.py` — runtime engine with fallback modes | `api/inference.py` |
| **7** | `evaluate_model.py` — eval graphs + stage attribution SHAP | `evaluate_model.py` |

Phase 1 is the foundation. Everything downstream depends on a realistic synthetic dataset.
