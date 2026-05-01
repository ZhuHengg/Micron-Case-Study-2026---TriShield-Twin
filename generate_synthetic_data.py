import os
import numpy as np
import pandas as pd

np.random.seed(42)

# --- CONSTANTS ---
TOTAL_UNITS = 2_000_000
N_HEALTHY   = 1_840_000   # 92%
N_DEFECTIVE = 160_000     # 8%

print(f"Starting generation of {TOTAL_UNITS} units...")

# --- STEP 1: GENERATE MACHINE POOLS ---
def generate_pool(prefix, count):
    return [f"{prefix}_{i:03d}" for i in range(1, count + 1)]

MACHINE_POOLS = {
    'die_bonder':   generate_pool('DB', 20),
    'wire_bonder':  generate_pool('WB', 40),
    'mold_press':   generate_pool('MP', 10),
    'ball_attach':  generate_pool('BA', 15),
    'saw':          generate_pool('SW', 8),
}

DEGRADED = {
    'die_bonder':   MACHINE_POOLS['die_bonder'][:3],
    'wire_bonder':  MACHINE_POOLS['wire_bonder'][:5],
    'mold_press':   MACHINE_POOLS['mold_press'][:2],
    'saw':          MACHINE_POOLS['saw'][:2],
}

RESIN_BATCHES     = [f'RESIN_{i:04d}' for i in range(50)]
BAD_RESIN_BATCHES = RESIN_BATCHES[:5]

machines_data = []
for stage, pool in MACHINE_POOLS.items():
    degraded_set = set(DEGRADED.get(stage, []))
    for m in pool:
        machines_data.append({
            'machine_id': m,
            'machine_type': stage,
            'pool': 'degraded' if m in degraded_set else 'healthy',
            'stage': stage,
            'machine_risk_score': 0.0
        })
df_machines = pd.DataFrame(machines_data)

# --- STEP 2: DEFINE ARCHETYPES ---
HEALTHY_ARCHETYPES = {
    'nominal_optimal':     {'weight': 0.50},
    'nominal_edge':        {'weight': 0.25},
    'marginal_drift':      {'weight': 0.15, 'uses_degraded_machines': True},
    'batch_variation':     {'weight': 0.10, 'uses_bad_resin': 0.30},
}

DEFECT_ARCHETYPES = {
    'void_delamination':      {'weight': 0.19, 'target_bin': 6, 'root_stage': 1},
    'wire_non_stick':         {'weight': 0.19, 'target_bin': 7, 'root_stage': 2},
    'wire_sweep':             {'weight': 0.12, 'target_bin': 8, 'root_stage': 3},
    'popcorn_delamination':   {'weight': 0.12, 'target_bins': [5,7], 'bin_weights': [0.6,0.4], 'root_stage': 3},
    'thermal_fracture':       {'weight': 0.15, 'target_bin': 7, 'root_stage': 4},
    'ball_bridge_saw':        {'weight': 0.11, 'target_bin': 8, 'root_stage': 5},
    'fab_defect_passthrough': {'weight': 0.12, 'target_bin': 4, 'root_stage': 0},
}

NOMINAL_PARAMS = {
    'stage1': {
        'bond_force':          {'mean': 30.0, 'std': 1.0},
        'xy_placement_offset': {'mean': 5.0,  'std': 2.0},
        'bond_line_thickness': {'mean': 25.0, 'std': 1.5},
        'epoxy_viscosity':     {'mean': 5000, 'std': 200},
        'pick_place_speed':    {'mean': 8000, 'std': 300},
    },
    'stage2': {
        'ultrasonic_power':      {'mean': 1.2,  'std': 0.1},
        'bond_time':             {'mean': 15.0, 'std': 1.0},
        'loop_height':           {'mean': 200,  'std': 10},
        'capillary_stroke_count':{'mean': 100000, 'std': 50000},
        'efo_voltage':           {'mean': 60,   'std': 2},
    },
    'stage3': {
        'transfer_pressure':   {'mean': 8.0,  'std': 0.4},
        'clamping_force':      {'mean': 50,   'std': 2.0},
        'molding_temperature': {'mean': 180,  'std': 2.0},
        'vacuum_level':        {'mean': 2.0,  'std': 0.5},
    },
    'stage4': {
        'ball_placement_accuracy': {'mean': 5.0,  'std': 2.0},
        'laser_pulse_energy':      {'mean': 12.0, 'std': 0.5},
        'reflow_peak_temp':        {'mean': 260,  'std': 2.0},
        'flux_density':            {'mean': 0.8,  'std': 0.05},
    },
    'stage5': {
        'spindle_current':     {'mean': 2.0,  'std': 0.1},
        'vibration_amplitude': {'mean': 0.5,  'std': 0.1},
        'blade_wear_index':    {'mean': 0.3,  'std': 0.1},
        'cooling_water_flow':  {'mean': 1.5,  'std': 0.1},
    }
}

ARCHETYPE_OVERRIDES = {
    'void_delamination': {
        'stage1': {
            'bond_force':          {'mean': 22.0, 'std': 3.0},
            'xy_placement_offset': {'mean': 12.0, 'std': 4.0},
            'bond_line_thickness': {'mean': 15.0, 'std': 3.0},
        }
    },
    'wire_non_stick': {
        'stage2': {
            'ultrasonic_power':       {'mean': 0.7, 'std': 0.15},
            'bond_time':              {'mean': 11.0, 'std': 1.5},
            'loop_height':            {'mean': 240, 'std': 15},
            'capillary_stroke_count': {'mean': 350000, 'std': 50000},
        }
    },
    'wire_sweep': {
        'stage3': {
            'transfer_pressure':   {'mean': 9.8, 'std': 0.3},
            'clamping_force':      {'mean': 55,  'std': 3.0},
        }
    },
    'popcorn_delamination': {
        'stage3': {
            'molding_temperature': {'mean': 173, 'std': 3.0},
            'vacuum_level':        {'mean': 8.5, 'std': 1.0},
        }
    },
    'thermal_fracture': {
        'stage4': {
            'reflow_peak_temp':        {'mean': 268, 'std': 3.0},
            'ball_placement_accuracy': {'mean': 18.0, 'std': 5.0},
        }
    },
    'ball_bridge_saw': {
        'stage4': {
            'ball_placement_accuracy': {'mean': 20.0, 'std': 5.0},
            'flux_density':            {'mean': 1.05, 'std': 0.1},
        },
        'stage5': {
            'spindle_current':     {'mean': 2.4, 'std': 0.2},
            'vibration_amplitude': {'mean': 1.2, 'std': 0.3},
            'blade_wear_index':    {'mean': 0.85, 'std': 0.1},
        }
    },
}

def get_stage_params(archetype_name, stage):
    params = {}
    for k, v in NOMINAL_PARAMS[stage].items():
        params[k] = v.copy()
    
    if archetype_name == 'nominal_edge':
        for k in params:
            params[k]['std'] *= 1.5
    elif archetype_name == 'marginal_drift':
        for k in params:
            params[k]['std'] *= 2.0
            
    if archetype_name in ARCHETYPE_OVERRIDES and stage in ARCHETYPE_OVERRIDES[archetype_name]:
        for k, v in ARCHETYPE_OVERRIDES[archetype_name][stage].items():
            params[k] = v.copy()
            
    return params

# --- STEP 3: RRS FUNCTIONS ---
def compute_rrs_stage1(unit):
    force_dev = abs(unit['bond_force'] - 30.0) / 5.0
    place_err = unit['xy_placement_offset'] / 15.0
    blt_dev   = abs(unit['bond_line_thickness'] - 25.0) / 7.0
    raw = force_dev * 0.40 + place_err * 0.35 + blt_dev * 0.25
    return np.clip(raw, 0.0, 1.0)

def compute_rrs_stage2(unit):
    power_dev = abs(unit['ultrasonic_power'] - 1.2) / 0.4
    time_dev  = abs(unit['bond_time'] - 15.0) / 5.0
    loop_dev  = abs(unit['loop_height'] - 200) / 50.0
    wear      = unit['capillary_stroke_count'] / 500_000
    raw = wear * 0.30 + power_dev * 0.30 + time_dev * 0.20 + loop_dev * 0.20
    return np.clip(raw, 0.0, 1.0)

def compute_rrs_stage3(unit):
    press_dev  = abs(unit['transfer_pressure'] - 8.0) / 2.0
    vac_risk   = unit['vacuum_level'] / 10.0
    temp_dev   = abs(unit['molding_temperature'] - 180) / 10.0
    resin_risk = unit.get('resin_batch_risk', 0.0)
    raw = vac_risk * 0.30 + temp_dev * 0.25 + press_dev * 0.25 + resin_risk * 0.20
    return np.clip(raw, 0.0, 1.0)

def compute_rrs_stage4(unit):
    temp_dev = abs(unit['reflow_peak_temp'] - 260) / 10.0
    ball_err = unit['ball_placement_accuracy'] / 25.0
    flux_dev = abs(unit['flux_density'] - 0.8) / 0.3
    raw = temp_dev * 0.35 + ball_err * 0.35 + flux_dev * 0.30
    return np.clip(raw, 0.0, 1.0)

def compute_rrs_stage5(unit):
    blade       = unit['blade_wear_index']
    vib_risk    = unit['vibration_amplitude'] / 1.5
    current_dev = abs(unit['spindle_current'] - 2.0) / 0.5
    raw = blade * 0.35 + vib_risk * 0.35 + current_dev * 0.30
    return np.clip(raw, 0.0, 1.0)

def compute_cumulative_rrs(prev_rrs, stage_rrs):
    interaction = prev_rrs * stage_rrs * 1.5
    cumulative = prev_rrs * 0.6 + stage_rrs * 0.3 + interaction * 0.1
    return np.clip(cumulative, 0.0, 1.0)

def pick_machine(stage_name, archetype_info):
    if archetype_info.get('uses_degraded_machines') and stage_name in DEGRADED:
        if np.random.rand() < 0.8:
            return np.random.choice(DEGRADED[stage_name])
    return np.random.choice(MACHINE_POOLS[stage_name])

def assign_bin(arch_name, archetype_info, is_defective):
    if not is_defective:
        rand = np.random.rand()
        if arch_name == 'nominal_optimal':
            return 1
        elif arch_name == 'nominal_edge':
            return 1 if rand < 0.85 else 2
        elif arch_name == 'marginal_drift':
            return 1 if rand < 0.60 else (2 if rand < 0.85 else 3)
        else: # batch_variation
            return 1 if rand < 0.70 else (2 if rand < 0.90 else 3)
    else:
        if 'target_bins' in archetype_info:
            return np.random.choice(archetype_info['target_bins'], p=archetype_info['bin_weights'])
        return archetype_info['target_bin']

# --- STEP 4: GENERATE RECORD ---
def generate_record(idx, arch_name, archetype, is_defective):
    unit = {'unit_id': f'UNIT_{idx:08d}'}

    unit['machine_db'] = pick_machine('die_bonder', archetype)
    unit['machine_wb'] = pick_machine('wire_bonder', archetype)
    unit['machine_mp'] = pick_machine('mold_press', archetype)
    unit['machine_ba'] = pick_machine('ball_attach', archetype)
    unit['machine_sw'] = pick_machine('saw', archetype)

    uses_bad_resin = archetype.get('uses_bad_resin', 0)
    if is_defective and archetype.get('uses_bad_resin', False) is True:
        uses_bad_resin = 1.0
    
    if np.random.rand() < uses_bad_resin:
        unit['resin_batch_id'] = np.random.choice(BAD_RESIN_BATCHES)
        unit['resin_batch_risk'] = 0.8
    else:
        unit['resin_batch_id'] = np.random.choice(RESIN_BATCHES)
        unit['resin_batch_risk'] = 0.1

    s1 = get_stage_params(arch_name, 'stage1')
    unit['bond_force']          = max(0, np.random.normal(s1['bond_force']['mean'], s1['bond_force']['std']))
    unit['xy_placement_offset'] = abs(np.random.normal(s1['xy_placement_offset']['mean'], s1['xy_placement_offset']['std']))
    unit['bond_line_thickness'] = max(0, np.random.normal(s1['bond_line_thickness']['mean'], s1['bond_line_thickness']['std']))
    unit['epoxy_viscosity']     = max(0, np.random.normal(s1['epoxy_viscosity']['mean'], s1['epoxy_viscosity']['std']))
    unit['pick_place_speed']    = max(0, np.random.normal(s1['pick_place_speed']['mean'], s1['pick_place_speed']['std']))
    unit['rrs_1'] = compute_rrs_stage1(unit)

    s2 = get_stage_params(arch_name, 'stage2')
    unit['ultrasonic_power']      = max(0, np.random.normal(s2['ultrasonic_power']['mean'], s2['ultrasonic_power']['std']))
    unit['bond_time']             = max(0, np.random.normal(s2['bond_time']['mean'], s2['bond_time']['std']))
    unit['loop_height']           = max(0, np.random.normal(s2['loop_height']['mean'], s2['loop_height']['std']))
    unit['capillary_stroke_count']= max(0, min(500000, np.random.normal(s2['capillary_stroke_count']['mean'], s2['capillary_stroke_count']['std'])))
    unit['efo_voltage']           = max(0, np.random.normal(s2['efo_voltage']['mean'], s2['efo_voltage']['std']))
    unit['rrs_2'] = compute_cumulative_rrs(unit['rrs_1'], compute_rrs_stage2(unit))

    s3 = get_stage_params(arch_name, 'stage3')
    unit['transfer_pressure']   = max(0, np.random.normal(s3['transfer_pressure']['mean'], s3['transfer_pressure']['std']))
    unit['clamping_force']      = max(0, np.random.normal(s3['clamping_force']['mean'], s3['clamping_force']['std']))
    unit['molding_temperature'] = max(0, np.random.normal(s3['molding_temperature']['mean'], s3['molding_temperature']['std']))
    unit['vacuum_level']        = max(0, np.random.normal(s3['vacuum_level']['mean'], s3['vacuum_level']['std']))
    unit['rrs_3'] = compute_cumulative_rrs(unit['rrs_2'], compute_rrs_stage3(unit))

    s4 = get_stage_params(arch_name, 'stage4')
    unit['ball_placement_accuracy'] = abs(np.random.normal(s4['ball_placement_accuracy']['mean'], s4['ball_placement_accuracy']['std']))
    unit['laser_pulse_energy']      = max(0, np.random.normal(s4['laser_pulse_energy']['mean'], s4['laser_pulse_energy']['std']))
    unit['reflow_peak_temp']        = max(0, np.random.normal(s4['reflow_peak_temp']['mean'], s4['reflow_peak_temp']['std']))
    unit['flux_density']            = max(0, np.random.normal(s4['flux_density']['mean'], s4['flux_density']['std']))
    unit['rrs_4'] = compute_cumulative_rrs(unit['rrs_3'], compute_rrs_stage4(unit))

    s5 = get_stage_params(arch_name, 'stage5')
    unit['spindle_current']     = max(0, np.random.normal(s5['spindle_current']['mean'], s5['spindle_current']['std']))
    unit['vibration_amplitude'] = max(0, np.random.normal(s5['vibration_amplitude']['mean'], s5['vibration_amplitude']['std']))
    unit['blade_wear_index']    = max(0, min(1.0, np.random.normal(s5['blade_wear_index']['mean'], s5['blade_wear_index']['std'])))
    unit['cooling_water_flow']  = max(0, np.random.normal(s5['cooling_water_flow']['mean'], s5['cooling_water_flow']['std']))
    unit['rrs_5'] = compute_cumulative_rrs(unit['rrs_4'], compute_rrs_stage5(unit))

    unit['rrs_delta_1'] = unit['rrs_1']
    unit['rrs_delta_2'] = unit['rrs_2'] - unit['rrs_1']
    unit['rrs_delta_3'] = unit['rrs_3'] - unit['rrs_2']
    unit['rrs_delta_4'] = unit['rrs_4'] - unit['rrs_3']
    unit['rrs_delta_5'] = unit['rrs_5'] - unit['rrs_4']

    unit['bin_code'] = assign_bin(arch_name, archetype, is_defective)
    
    unit['machine_risk_score'] = 0.0
    unit['resin_batch_risk_score'] = 0.0

    return unit

# --- STEP 5: GENERATE ALL RECORDS ---
records = []
healthy_choices = np.random.choice(
    list(HEALTHY_ARCHETYPES.keys()),
    size=N_HEALTHY,
    p=[a['weight'] for a in HEALTHY_ARCHETYPES.values()]
)
print("Generating healthy units...")
for i in range(N_HEALTHY):
    arch_name = healthy_choices[i]
    records.append(generate_record(i, arch_name, HEALTHY_ARCHETYPES[arch_name], False))
    if i % 500000 == 0 and i > 0:
        print(f"  {i} / {N_HEALTHY}")

print("Generating defective units...")
defect_idx = N_HEALTHY
for arch_name, arch in DEFECT_ARCHETYPES.items():
    count = int(N_DEFECTIVE * arch['weight'])
    for i in range(count):
        records.append(generate_record(defect_idx + i, arch_name, arch, True))
    defect_idx += count

while defect_idx < TOTAL_UNITS:
    records.append(generate_record(defect_idx, 'void_delamination', DEFECT_ARCHETYPES['void_delamination'], True))
    defect_idx += 1

print("Converting to DataFrame...")
df = pd.DataFrame(records)

# --- STEP 6: COMPUTE MACHINE RISK SCORE ---
print("Computing empirical machine risk scores...")
df['is_defective'] = (df['bin_code'] >= 4).astype(int)

for stage_col in ['machine_db', 'machine_wb', 'machine_mp', 'machine_ba', 'machine_sw']:
    machine_stats = df.groupby(stage_col).agg(
        total_units      = ('unit_id', 'count'),
        defect_rate      = ('is_defective', 'mean'),
        avg_rrs          = ('rrs_5', 'mean'),
        max_rrs          = ('rrs_5', 'max'),
    ).reset_index()

    machine_stats['risk'] = (
        machine_stats['defect_rate'] * 0.40 +
        machine_stats['avg_rrs']     * 0.35 +
        machine_stats['max_rrs']     * 0.25
    ).clip(0, 1).round(3)

    risk_map = dict(zip(machine_stats[stage_col], machine_stats['risk']))
    df[f'{stage_col}_risk'] = df[stage_col].map(risk_map)

stage_risk_cols = ['machine_db_risk', 'machine_wb_risk', 'machine_mp_risk',
                   'machine_ba_risk', 'machine_sw_risk']

correlations = {}
for col in stage_risk_cols:
    correlations[col] = abs(df[col].corr(df['is_defective']))

total_corr = sum(correlations.values())
empirical_weights = {col: corr / total_corr for col, corr in correlations.items()}

df['machine_risk_score'] = sum(
    df[col] * weight for col, weight in empirical_weights.items()
).round(3)

print("\n=== EMPIRICAL MACHINE RISK WEIGHTS ===")
for col, w in empirical_weights.items():
    print(f"  {col}: {w:.4f} (corr={correlations[col]:.4f})")

# Resin risk
resin_stats = df.groupby('resin_batch_id').agg(
    defect_rate = ('is_defective', 'mean')
).reset_index()
resin_stats['resin_batch_risk_score'] = (resin_stats['defect_rate'] / resin_stats['defect_rate'].max()).clip(0, 1).round(3)
resin_map = dict(zip(resin_stats['resin_batch_id'], resin_stats['resin_batch_risk_score']))
df['resin_batch_risk_score'] = df['resin_batch_id'].map(resin_map)

# --- STEP 7: INJECT NOISE ---
print("\nInjecting noise...")
noise_idx_1 = df[df['is_defective']==0].sample(frac=0.08).index
for stg, p_name in zip(['machine_db', 'machine_wb', 'machine_mp', 'machine_sw'], ['die_bonder', 'wire_bonder', 'mold_press', 'saw']):
    if stg in df.columns:
        df.loc[noise_idx_1, stg] = [np.random.choice(DEGRADED[p_name]) for _ in range(len(noise_idx_1))]

is_degraded_machine = df['machine_db'].isin(DEGRADED['die_bonder'])
noise = np.where(is_degraded_machine, np.random.normal(-0.03, 0.06, len(df)), np.random.normal(0, 0.05, len(df)))
df['machine_risk_score'] = (df['machine_risk_score'] + noise).clip(0, 1).round(3)

# --- STEP 8: SHUFFLE AND ENFORCE COLUMN ORDER ---
print("Shuffling and formatting...")
df = df.sample(frac=1, random_state=42).reset_index(drop=True)

FINAL_COLUMNS = [
    'unit_id',
    'bond_force', 'xy_placement_offset', 'bond_line_thickness', 'epoxy_viscosity', 'pick_place_speed',
    'ultrasonic_power', 'bond_time', 'loop_height', 'capillary_stroke_count', 'efo_voltage',
    'transfer_pressure', 'clamping_force', 'molding_temperature', 'vacuum_level', 'resin_batch_id',
    'ball_placement_accuracy', 'laser_pulse_energy', 'reflow_peak_temp', 'flux_density',
    'spindle_current', 'vibration_amplitude', 'blade_wear_index', 'cooling_water_flow',
    'rrs_1', 'rrs_2', 'rrs_3', 'rrs_4', 'rrs_5',
    'rrs_delta_1', 'rrs_delta_2', 'rrs_delta_3', 'rrs_delta_4', 'rrs_delta_5',
    'machine_risk_score', 'resin_batch_risk_score',
    'machine_db', 'machine_wb', 'machine_mp', 'machine_ba', 'machine_sw',
    'bin_code',
]

# --- STEP 9: SANITY CHECKS ---
print("\n=== SANITY CHECKS ===")
print(f"Total rows: {len(df)}")
print("\nBin Distribution (%):")
print(df['bin_code'].value_counts(normalize=True).sort_index() * 100)
print("\nAvg RRS_5 by Defect Status:")
print(df.groupby('is_defective')['rrs_5'].mean())

# --- STEP 10: SAVE ---
print("\nSaving files...")
os.makedirs('data', exist_ok=True)
df[FINAL_COLUMNS].to_csv('data/synthetic_backend_assembly.csv', index=False, chunksize=50000)
df_machines.to_csv('data/machines.csv', index=False)
print("Done! Data saved to 'data' directory.")
