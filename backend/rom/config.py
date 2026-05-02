import numpy as np

# --- GRID CONSTANTS ---
GRID_SIZE = 50
N_GRID_TOTAL = GRID_SIZE * GRID_SIZE

# --- SVD CONSTANTS ---
N_SNAPSHOTS = 50
ENERGY_THRESHOLD = 0.99
MAX_MODES = 20

# --- FEATURE DEFINITIONS ---
# Used for mapping dictionary features to ordered numpy arrays
PARAM_COLUMNS = [
    # Stage 1
    'bond_force', 'xy_placement_offset', 'bond_line_thickness',
    'epoxy_viscosity', 'pick_place_speed',
    # Stage 2
    'ultrasonic_power', 'bond_time', 'loop_height',
    'capillary_stroke_count', 'efo_voltage',
    # Stage 3
    'transfer_pressure', 'clamping_force', 'molding_temperature', 'vacuum_level',
    # Stage 4
    'ball_placement_accuracy', 'laser_pulse_energy', 'reflow_peak_temp', 'flux_density',
    # Stage 5
    'spindle_current', 'vibration_amplitude', 'blade_wear_index', 'cooling_water_flow'
]

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

# --- NOMINAL VALUES FOR DEVIATION CALCULATIONS ---
NOMINAL = {
    # Stage 1 — Die Bond
    'bond_force': 30.0,
    'xy_placement_offset': 0.0,
    'bond_line_thickness': 25.0,
    'epoxy_viscosity': 5000.0,
    'pick_place_speed': 8000.0,
    # Stage 2 — Wire Bond
    'ultrasonic_power': 1.2,
    'bond_time': 15.0,
    'loop_height': 200.0,
    'capillary_stroke_count': 0.0,
    'efo_voltage': 60.0,
    # Stage 3 — Mold
    'transfer_pressure': 8.0,
    'clamping_force': 50.0,
    'molding_temperature': 180.0,
    'vacuum_level': 0.0,  # Ideal
    # Stage 4 — Ball Attach
    'ball_placement_accuracy': 0.0,
    'laser_pulse_energy': 12.0,
    'reflow_peak_temp': 260.0,
    'flux_density': 0.8,
    # Stage 5 — Saw
    'spindle_current': 2.0,
    'vibration_amplitude': 0.0,
    'blade_wear_index': 0.0,
    'cooling_water_flow': 1.5,
}

