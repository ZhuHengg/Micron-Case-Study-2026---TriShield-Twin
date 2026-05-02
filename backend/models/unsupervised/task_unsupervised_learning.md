# TASK: Unsupervised Learning Pipeline — Shield 2 (Isolation Forest)
**Project Aeternum — Phase 3**

---

## Objective
Build the Isolation Forest anomaly detection pipeline (Shield 2 of the Tri-Shield architecture). This model operates independently from Shield 1 (LightGBM). It does not use labels during training—it learns what a "normal" semiconductor unit looks like, and flags anything that deviates as an anomaly.

**Primary Goal**: Catch the 19% of defects that Shield 1 missed (especially Bin 4 "Fab Passthrough" units that look healthy to the supervised model).

---

## Reference Architecture
Mirrored from: `FraudShieldAI-Vhack2026/backend/models/unsupervised/isolation_forest/`

| FraudShieldAI File | Micron Adaptation |
| :--- | :--- |
| `data_loader.py` | Identical structure. Stratify on `bin_code` instead of `is_fraud`. |
| `preprocessing.py` | Simplified. No label encoding, no SMOTE, no recipient risk. Just StandardScaler on 34 numerical features. |
| `model.py` | Same `IsolationForest` wrapper. Contamination set to `0.08` (our 8% defect rate). |
| `evaluation.py` | Adapted for binary Sellable vs. Scrap. Adds bias detection and feature split analysis. |
| `train.py` | Same orchestration flow. 11-step pipeline. |

---

## Directory Structure
Target: `MicronCaseStudy/backend/models/unsupervised/isolation_forest/`

Files created:
1. `data_loader.py`
2. `preprocessing.py`
3. `model.py`
4. `evaluation.py`
5. `train.py`

Output directories (auto-created by `train.py`):
- `outputs/model/` — saved model artifacts
- `outputs/plots/` — PR curve, confusion matrix, risk score distribution, feature analysis
- `outputs/results/` — classification report, top anomalies, training report

---

## Detailed File Specifications

### 1. `data_loader.py`
**Purpose**: Load and split the dataset into Train / Val / Test.

**What it does**:
- Reads `synthetic_backend_assembly.csv` from `backend/data/`.
- Performs a 3-way stratified split (64% Train / 16% Val / 20% Test), stratified on `bin_code`.
- Prints shape, defect rate, and bin distribution for each split.

### 2. `preprocessing.py`
**Purpose**: Scale numerical features for the Isolation Forest.

**What it does**:
- Takes the same 34 numerical features defined in the supervised pipeline.
- Fits `StandardScaler` on **Train only**, transforms all three splits.
- Extracts `y_train`, `y_val`, `y_test` as binary `is_defective` (not multiclass `bin_code`).

### 3. `model.py`
**Purpose**: Wrap `sklearn.ensemble.IsolationForest` with scoring, threshold management, and tier assignment.

**What it does**:
- Initializes `IsolationForest` with `contamination=0.08`.
- Normalizes scores to a 0-100 scale using `MinMaxScaler`.
- Maps scores to "Approve", "Flag", or "Block".

### 4. `evaluation.py`
**Purpose**: Metrics, visualizations, threshold tuning, and bias analysis.

### 5. `train.py`
**Purpose**: Main orchestrator script. Runs the full pipeline end-to-end.

---

## Execution
```powershell
cd "C:\Users\chinp\OneDrive\Documents\VHack Reference\MicronCaseStudy\backend\models\unsupervised\isolation_forest"
python train.py
```

---
*End of Execution Plan*
