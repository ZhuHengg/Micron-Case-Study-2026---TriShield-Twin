# TASK: Supervised Learning Pipeline (Shield 1)

## Objective
Build the LightGBM supervised learning pipeline for the Tri-Shield ML architecture. This mirrors the `FraudShieldAI` structure but is adapted for multiclass semiconductor defect prediction (Bins 1-8).

## Directory Structure
Target directory: `MicronCaseStudy/backend/models/supervised/`

Files to create:
1. `data_loader.py`
2. `preprocessing.py`
3. `model.py`
4. `evaluation.py`
5. `train.py`

---

## File Specifications

### 1. `data_loader.py`
- **Purpose**: Load the synthetic dataset and split it cleanly.
- **Key differences from FraudShieldAI**:
  - We stratify based on `bin_code` instead of `is_fraud` to ensure all rare defect types (like thermal fracture) are represented across train, val, and test splits.
- **Output**: Returns `df_train`, `df_val`, `df_test`. (64% / 16% / 20% split).

### 2. `preprocessing.py`
- **Purpose**: Scale numerical features and handle any data transformations.
- **Key differences from FraudShieldAI**:
  - **No SMOTE needed**: Because we are doing multiclass prediction, standard SMOTE gets complicated and can blur the boundaries between specific defects. Instead, we rely on LightGBM's `class_weight='balanced'`.
  - Machine Risk Scores and RRS cascading features are already built into the CSV during Phase 1, so this script just needs to apply a `StandardScaler` to the numerical columns.

### 3. `model.py`
- **Purpose**: Object-Oriented wrapper for the LightGBM model.
- **Key differences from FraudShieldAI**:
  - **Objective**: Changed from `binary` to `multiclass`.
  - **Num_Class**: Set to `8` (for bins 1 through 8).
  - **Metric**: `multi_logloss`.
  - **Class Weighting**: Use `class_weight='balanced'` in LGBMClassifier to heavily penalize missing rare defect bins.
  - **`predict_scaled()` adaptation**: 
    - In FraudShieldAI, this was just `P(Fraud) * 100`. 
    - For Micron, sellable units are Bins 1, 2, and 3. Scrap/Defects are Bins 4 through 8.
    - Risk Score formula: `(1.0 - (P(Bin_1) + P(Bin_2) + P(Bin_3))) * 100` 
    - This provides a clean 0-100 risk score representing the probability that the unit is defective (Bin 4+).

### 4. `evaluation.py`
- **Purpose**: Metrics, visualizations, and empirical threshold tuning.
- **Key differences from FraudShieldAI**:
  - **Multiclass Metrics**: Needs to print a confusion matrix for all 8 bins and report Macro F1.
  - **Threshold Tuning**: We tune the "Approve/Flag/Block" threshold based on the custom Risk Score (0-100) vs the binary `is_defective` ground truth.
  - Generates SHAP plots (handled here or in a later phase).

### 5. `train.py`
- **Purpose**: The main orchestrator script.
- **Workflow**:
  1. Calls `load_data()` and `split_data()`.
  2. Calls `preprocess_features()`.
  3. Initializes `LightGBMModel()` and calls `fit()` using early stopping on the validation set.
  4. Calls `tune_threshold()` on the validation set to find the optimal cut-off for "Sellable vs Scrap".
  5. Evaluates the test set using `predict_with_tier()` and prints the final performance.
  6. Saves the model artifact to `outputs/model/`.

---

## Execution Steps
1. Create the files exactly as spec'd above inside `backend/models/supervised/`.
2. Ensure the code reads from `../../../data/synthetic_backend_assembly.csv`.
3. Run `python train.py` and verify it produces strong Macro F1 and realistic threshold boundaries.
