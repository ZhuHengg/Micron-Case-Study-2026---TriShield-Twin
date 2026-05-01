import pandas as pd
from sklearn.preprocessing import StandardScaler

# All numerical features used for training
NUMERICAL_FEATURES = [
    'bond_force', 'xy_placement_offset', 'bond_line_thickness', 'epoxy_viscosity', 'pick_place_speed',
    'ultrasonic_power', 'bond_time', 'loop_height', 'capillary_stroke_count', 'efo_voltage',
    'transfer_pressure', 'clamping_force', 'molding_temperature', 'vacuum_level',
    'ball_placement_accuracy', 'laser_pulse_energy', 'reflow_peak_temp', 'flux_density',
    'spindle_current', 'vibration_amplitude', 'blade_wear_index', 'cooling_water_flow',
    'rrs_1', 'rrs_2', 'rrs_3', 'rrs_4', 'rrs_5',
    'rrs_delta_1', 'rrs_delta_2', 'rrs_delta_3', 'rrs_delta_4', 'rrs_delta_5',
    'machine_risk_score', 'resin_batch_risk_score'
]

def preprocess_features(df_train: pd.DataFrame, df_val: pd.DataFrame, df_test: pd.DataFrame):
    print("\n" + "="*50)
    print("STEP 4: PREPROCESSING (SCALING NO SMOTE)")
    print("="*50)
    
    # We predict the multiclass bin_code (but lightgbm expects 0-indexed classes)
    # Our bins are 1-8, so we subtract 1.
    y_train = df_train['bin_code'] - 1
    y_val   = df_val['bin_code'] - 1
    y_test  = df_test['bin_code'] - 1
    
    scaler = StandardScaler()
    
    # Fit scaler on TRAIN only
    X_train_scaled = scaler.fit_transform(df_train[NUMERICAL_FEATURES])
    X_val_scaled   = scaler.transform(df_val[NUMERICAL_FEATURES])
    X_test_scaled  = scaler.transform(df_test[NUMERICAL_FEATURES])
    
    # Convert back to DataFrame
    X_train = pd.DataFrame(X_train_scaled, columns=NUMERICAL_FEATURES)
    X_val   = pd.DataFrame(X_val_scaled, columns=NUMERICAL_FEATURES)
    X_test  = pd.DataFrame(X_test_scaled, columns=NUMERICAL_FEATURES)
    
    print(f"Features scaled: {len(NUMERICAL_FEATURES)}")
    return X_train, X_val, X_test, y_train, y_val, y_test, scaler, NUMERICAL_FEATURES
