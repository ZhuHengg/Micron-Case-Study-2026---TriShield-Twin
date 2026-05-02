import numpy as np
import pandas as pd
import pickle
import os
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler, PolynomialFeatures
from sklearn.pipeline import make_pipeline

from config import GRID_SIZE, N_GRID_TOTAL, MAX_MODES, ENERGY_THRESHOLD, PARAM_COLUMNS
from stress_model import compute_stress_field

# Override snapshot count — 200 gives much better coefficient prediction
N_SNAPSHOTS_OVERRIDE = 200

def build_rom():
    print("="*50)
    print("BUILDING ROM PIPELINE")
    print("="*50)
    
    # 1. Load the synthetic CSV
    csv_path = '../data/synthetic_backend_assembly.csv'
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Missing {csv_path}. Please generate data first.")
        
    print("Loading synthetic data...")
    df = pd.read_csv(csv_path)
    n_snapshots = N_SNAPSHOTS_OVERRIDE
    
    # 2. Stratified sampling — ensure every bin is represented
    print(f"Sampling {n_snapshots} units for snapshots (stratified)...")
    samples_list = []
    for bin_code in sorted(df['bin_code'].unique()):
        bin_df = df[df['bin_code'] == bin_code]
        # Allocate proportionally but guarantee at least 5 per bin
        n_bin = max(5, int(n_snapshots * len(bin_df) / len(df)))
        samples_list.append(bin_df.sample(min(n_bin, len(bin_df)), random_state=42))
    
    samples = pd.concat(samples_list)
    # Trim or pad to exact count
    if len(samples) > n_snapshots:
        samples = samples.sample(n_snapshots, random_state=42)
    elif len(samples) < n_snapshots:
        needed = n_snapshots - len(samples)
        extras = df.drop(samples.index).sample(needed, random_state=42)
        samples = pd.concat([samples, extras])
    
    samples = samples.reset_index(drop=True)
    actual_n = len(samples)
    print(f"  Actual snapshot count: {actual_n}")

    # 3. Generate snapshot matrix
    print("Computing spatial stress fields for all snapshots...")
    snapshot_matrix = np.zeros((N_GRID_TOTAL, actual_n))
    
    for i, (_, row) in enumerate(samples.iterrows()):
        params = row.to_dict()
        stress_grid = compute_stress_field(params)
        snapshot_matrix[:, i] = stress_grid.flatten()
        if (i+1) % 50 == 0:
            print(f"  {i+1}/{actual_n} snapshots computed")

    # 4. Center data (subtract mean field)
    print("Performing SVD...")
    mean_field = snapshot_matrix.mean(axis=1)
    centered = snapshot_matrix - mean_field[:, np.newaxis]
    
    # 5. SVD
    U, S, Vt = np.linalg.svd(centered, full_matrices=False)
    
    # 6. Determine k using energy criterion
    energy = np.cumsum(S**2) / np.sum(S**2)
    k = np.searchsorted(energy, ENERGY_THRESHOLD) + 1
    k = max(k, 5)  # Minimum 5 modes for expressiveness
    k = min(k, MAX_MODES)
    
    print(f"  Singular values (top 10): {np.round(S[:10], 1)}")
    print(f"  Energy captured: k=3->{energy[2]*100:.1f}%, k=5->{energy[min(4,len(S)-1)]*100:.1f}%, "
          f"k=10->{energy[min(9,len(S)-1)]*100:.1f}%")
    print(f"  Selected k={k} modes ({energy[k-1]*100:.2f}% energy)")
    
    # 7. Truncate
    pod_modes = U[:, :k]
    coefficients = np.diag(S[:k]) @ Vt[:k, :]  # (k, n_snapshots)
    
    # Save SVD outputs
    os.makedirs('artifacts', exist_ok=True)
    np.save('artifacts/pod_modes.npy', pod_modes)
    np.save('artifacts/mean_field.npy', mean_field)
    np.save('artifacts/singular_values.npy', S)
    print("Saved SVD artifacts.")
    
    # 8. Train coefficient predictor (Polynomial features + Ridge for nonlinearity)
    print("Training coefficient predictor...")
    X_train = samples[PARAM_COLUMNS].values  # (n_snapshots, 22)
    Y_train = coefficients.T                  # (n_snapshots, k)
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_train)
    
    # Degree 2 polynomial features capture cross-term interactions
    poly = PolynomialFeatures(degree=2, interaction_only=False, include_bias=False)
    X_poly = poly.fit_transform(X_scaled)
    print(f"  Feature expansion: {X_scaled.shape[1]} -> {X_poly.shape[1]} features")
    
    model = Ridge(alpha=10.0)  # Best bias-variance tradeoff for this feature count
    model.fit(X_poly, Y_train)
    
    with open('artifacts/coeff_model.pkl', 'wb') as f:
        pickle.dump({'model': model, 'scaler': scaler, 'poly': poly}, f)
    print("Saved Coefficient Predictor model.")
    
    # 9. Validation — check reconstruction on training set
    print("\nValidation (training set):")
    Y_pred = model.predict(X_poly)
    errors = []
    for i in range(actual_n):
        reconstructed = mean_field + pod_modes @ Y_pred[i]
        ground_truth = snapshot_matrix[:, i]
        err = np.linalg.norm(reconstructed - ground_truth) / np.linalg.norm(ground_truth)
        errors.append(err)
    
    print(f"  Avg reconstruction error: {np.mean(errors)*100:.2f}%")
    print(f"  Max reconstruction error: {np.max(errors)*100:.2f}%")
    print(f"  Median reconstruction error: {np.median(errors)*100:.2f}%")
    
    # 10. Validation — check on held-out units
    print("\nValidation (held-out set):")
    holdout = df.drop(samples.index).sample(50, random_state=99)
    holdout_errors = []
    for _, row in holdout.iterrows():
        params = row.to_dict()
        ground_truth = compute_stress_field(params).flatten()
        
        x = np.array([[params.get(p, 0.0) for p in PARAM_COLUMNS]])
        x_s = scaler.transform(x)
        x_p = poly.transform(x_s)
        alpha = model.predict(x_p)[0]
        reconstructed = mean_field + pod_modes @ alpha
        
        err = np.linalg.norm(reconstructed - ground_truth) / np.linalg.norm(ground_truth)
        holdout_errors.append(err)
    
    print(f"  Avg reconstruction error: {np.mean(holdout_errors)*100:.2f}%")
    print(f"  Max reconstruction error: {np.max(holdout_errors)*100:.2f}%")
    
    print("\nROM Build Complete.")

if __name__ == '__main__':
    build_rom()
