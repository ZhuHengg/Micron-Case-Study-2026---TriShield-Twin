# Phase 4 & 5: Shield 3 (Physics Rules) + Ensemble Fusion
**Project Aeternum — Tri-Shield Engine**

## Context from Shield 1 & Shield 2 Results

### Per-Bin Recall Gap Analysis
| Defect | Shield 1 (LGB) | Shield 2 (IF) | Combined Gap |
| :--- | ---: | ---: | :--- |
| Bin 4 (Fab Passthrough) | 5.3% | 0.0% | BLIND SPOT |
| Bin 5 (High-Temp Fail) | 80.6% | 97.2% | Covered |
| Bin 6 (DC Leakage) | 100% | 100% | Covered |
| Bin 7 (Open Circuit) | 48.7% | 98.0% | Covered |
| Bin 8 (Short Circuit) | 100% | 87.7% | Covered |

Shield 3 must primarily target Bin 4 (Fab Passthrough).

## Architecture (Mirroring FraudShieldAI)

### FraudShieldAI Mapping -> Micron Adaptation

| FraudShieldAI File | Role | Micron Equivalent |
| :--- | :--- | :--- |
| `behavioral_profiler.py` | Shield 3: Rule-based heuristic scorer | `physics_rules.py` |
| `ensemble_model.py` | Loads all 3 trained models, prepares features | `ensemble_model.py` |
| `score_fusion.py` | Weighted score combination + grid search | `score_fusion.py` |
| `evaluation.py` | Confusion matrix, ROC, distribution plots | `evaluation.py` |
| `run_ensemble.py` | End-to-end orchestrator | `run_ensemble.py` |

## File Plan

### File 1: `physics_rules.py` (Shield 3)
**Purpose:** Rule-based physics heuristic scorer that catches what ML cannot.
**Key difference from FraudShieldAI:** The `BehavioralProfiler` checks transaction patterns (drain accounts, rapid sessions). Our `PhysicsRuleEngine` checks manufacturing physics violations.

Rules to implement:
1. **RRS Accumulation Anomaly (weight: 0.30):** If `rrs_5` is high but individual `rrs_delta` values are all small, the unit accumulated stress invisibly -- a hallmark of Fab Passthrough.
2. **Machine Risk Escalation (weight: 0.25):** If `machine_risk_score` exceeds a safety threshold AND the unit passed all sensor checks, flag it -- the machine may be drifting.
3. **Thermal-Vacuum Violation (weight: 0.25):** If `molding_temperature` and `vacuum_level` are both in the marginal zone simultaneously, the mold compound may have incomplete fill.
4. **Stage Delta Inversion (weight: 0.20):** If any `rrs_delta` is negative (stress decreased between stages), flag it -- this is physically impossible under normal processing and indicates a sensor calibration error or Fab Passthrough.

Output: 0-100 risk score + human-readable reason list (same interface as BehavioralProfiler).

### File 2: `ensemble_model.py`
**Purpose:** Loads Shield 1 (LGB) and Shield 2 (IF) artifacts, prepares features.
**Key difference:** FraudShieldAI had separate feature sets for LGB and IF. Our Micron models use the same 34 features for both, so feature prep is simpler.

### File 3: `score_fusion.py`
**Purpose:** Weighted fusion of 3 scores + grid search for optimal weights.
**Identical structure to FraudShieldAI.** Grid search on validation set, PR curve threshold tuning.

### File 4: `evaluation.py`
**Purpose:** Plots (confusion matrix, ROC, risk distribution, score comparison, weight heatmap).
**Adapted labels:** "Sellable/Scrap" instead of "Legit/Fraud". Per-bin recall included.

### File 5: `run_ensemble.py`
**Purpose:** End-to-end orchestrator.
**Steps:**
1. Load data + recreate identical split
2. Load Shield 1 and Shield 2 trained artifacts
3. Score validation set with all 3 shields
4. Grid search weights on validation set
5. Tune threshold on validation set
6. Score test set
7. Evaluate on test set
8. Per-bin recall comparison (Shield 1 vs Shield 2 vs Ensemble)
9. Save ensemble config

## Execution
```powershell
cd "C:\Users\chinp\OneDrive\Documents\VHack Reference\MicronCaseStudy\backend\models\ensemble"
python run_ensemble.py
```
