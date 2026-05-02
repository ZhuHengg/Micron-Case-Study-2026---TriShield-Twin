# Shield 1: Supervised LightGBM Training Report
**Project Aeternum — Phase 2: Supervised ML**

---

## 1. Execution Overview
- **Model Type**: LightGBM Multiclass Classifier
- **Target**: 8 Manufacturing Bins
- **Dataset**: 40,000 Blind Test Units
- **Iterations**: 500 rounds completed

---

## 2. Decision Thresholds
*Thresholds derived from PR-Curve optimization on the validation set.*

| Tier | Range | Action |
| :--- | :--- | :--- |
| **Approve** | Score < 98.32 | Ship to customer |
| **Flag** | 98.32 – 99.16 | Secondary Inspection |
| **Block** | Score > 99.16 | Scrap / Reject |

**Note**: Optimal decision threshold is set at **98.32** to maximize defect capture while maintaining 100% precision for scrap.

---

## 3. Multiclass Performance (Bin-by-Bin)
| Bin | Description | Precision | Recall | F1-Score | Support |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Bin 1 | Healthy | 0.84 | 0.83 | 0.84 | 30,019 |
| Bin 2 | Marginal Edge | 0.20 | 0.24 | 0.22 | 3,983 |
| Bin 3 | Marginal Drift | 0.34 | 0.23 | 0.27 | 2,798 |
| Bin 4 | Fab Passthrough | 0.03 | 0.05 | 0.04 | 620 |
| Bin 5 | Popcorn Delam | 0.62 | 0.81 | 0.70 | 609 |
| Bin 6 | Void Delam | 1.00 | 1.00 | 1.00 | 592 |
| Bin 7 | Thermal Fracture | 0.71 | 0.49 | 0.58 | 593 |
| Bin 8 | Ball Bridge/Saw | 1.00 | 1.00 | 1.00 | 786 |

---

## 4. Binary Decision Performance
*Sellable (Bins 1-3) vs. Scrap (Bins 4-8)*

| Category | Precision | Recall | F1-Score | Support |
| :--- | :--- | :--- | :--- | :--- |
| Sellable | 0.98 | 1.00 | 0.99 | 36,800 |
| Scrap | **1.00** | 0.81 | 0.89 | 3,200 |

- **Final Accuracy**: 98.00%
- **Strategy**: High-Precision. Guarantees that blocked units are definitely defective.

---

## 5. Visual Analysis Summary

### 5.1 PR Curve
- **Plateau**: Maintains 1.0 Precision until 0.80 Recall.
- **The Knee**: 98.32 threshold represents the maximum volume of defects caught before errors occur.

### 5.2 Confusion Matrix
- **Detections**: Bins 6 and 8 are perfectly classified (100% accuracy).
- **Confusion**: Bins 1, 2, and 3 overlap due to subtle physical drift signals.
- **Blind Spot**: Bin 4 (Fab errors) is mostly misclassified as Bin 1, as expected.

---

## 6. Phase 3 Targets
- Use **Isolation Forest** to identify Bin 4 anomalies that mimic healthy units.
- Flag "Marginal" units (Bins 2/3) that are drifting from the healthy baseline.

---
*End of Report*
