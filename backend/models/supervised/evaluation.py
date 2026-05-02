import matplotlib
matplotlib.use("Agg")  # Non-interactive backend
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np
import os
from sklearn.metrics import (
    classification_report, confusion_matrix,
    roc_curve, auc, precision_recall_curve
)

def tune_threshold(y_true, risk_scores, out_plots):
    """
    y_true is multiclass (0-7). We map it to binary (0 for pass, 1 for fail)
    where classes 0, 1, 2 are PASS, and 3, 4, 5, 6, 7 are FAIL.
    risk_scores are 0-100.

    This is the ONLY legitimate source of threshold values.
    Returns best_threshold, best_precision, best_recall, best_f1
    """
    print("\n" + "="*60)
    print("EMPIRICAL THRESHOLD TUNING (ON VALIDATION SET)")
    print("="*60)
    
    # Map ground truth to binary defect indicator
    y_binary = (y_true >= 3).astype(int)
    
    # risk_scores are 0-100, we need them in 0-1 for PR curve
    probs = risk_scores / 100.0
    
    precisions, recalls, thresholds = precision_recall_curve(y_binary, probs)
    
    f1_scores = 2 * (precisions * recalls) / (precisions + recalls + 1e-10)
    best_idx = np.argmax(f1_scores)
    best_threshold_01 = thresholds[best_idx]
    
    best_threshold = best_threshold_01 * 100
    best_f1 = f1_scores[best_idx]
    best_precision = precisions[best_idx]
    best_recall = recalls[best_idx]
    
    print(f"Optimal Threshold: {best_threshold:.2f} (Risk Score)")
    print(f"Precision:         {best_precision:.2%}")
    print(f"Recall:            {best_recall:.2%}")
    print(f"F1 Score:          {best_f1:.4f}")

    # Show precision at different recall targets
    print(f"\nPrecision at different recall targets (validation):")
    for target_recall in [0.95, 0.90, 0.85, 0.80, 0.70]:
        idx = np.argmin(np.abs(recalls - target_recall))
        if idx < len(thresholds):
            print(f"  Recall={target_recall:.0%}: "
                  f"precision={precisions[idx]:.2%}  "
                  f"threshold={thresholds[idx]*100:.2f}  "
                  f"F1={f1_scores[idx]:.3f}")
    
    # Plot PR curve
    fig, ax = plt.subplots(figsize=(10, 6))
    ax.plot(recalls, precisions, color='steelblue', linewidth=2, label='Precision-Recall curve')
    ax.scatter(best_recall, best_precision, color='red', s=150, zorder=5,
        label=(f'Optimal: threshold={best_threshold:.1f}\n'
               f'P={best_precision:.2%} | R={best_recall:.2%} | F1={best_f1:.3f}'))
    ax.axhline(0.50, color='orange', linestyle='--', alpha=0.7, label='Precision=50% reference')
    ax.set_xlabel('Recall')
    ax.set_ylabel('Precision')
    ax.set_title('Precision-Recall Curve\n(Threshold tuned on Validation Set)')
    ax.legend(loc='upper right')
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    
    pr_plot_path = os.path.join(out_plots, 'pr_curve.png')
    fig.savefig(pr_plot_path, dpi=150)
    plt.close(fig)
    print(f"Saved: {pr_plot_path}")
    
    return best_threshold, best_precision, best_recall, best_f1


def evaluate_predictions(y_true, y_pred_classes, y_pred_binary, df_results, all_features, out_plots, out_results):
    """
    Full evaluation suite for supervised LightGBM model.
    Generates classification reports, confusion matrix, ROC, risk distribution,
    top defects CSV, and predicted defects CSV.
    """
    print("=" * 60)
    print("FINAL EVALUATION ON UNSEEN TEST SET")
    print("=" * 60)

    # 1. Multiclass classification report
    print("\n=== MULTICLASS PERFORMANCE (BINS 1-8) ===")
    multiclass_report = classification_report(
        y_true, y_pred_classes,
        target_names=[f'Bin {i}' for i in range(1, 9)],
        digits=4
    )
    print(multiclass_report)

    # 2. Binary classification report
    print("\n=== BINARY PERFORMANCE (SELLABLE VS SCRAP) ===")
    y_true_binary = (y_true >= 3).astype(int)
    binary_report = classification_report(
        y_true_binary, y_pred_binary,
        target_names=['Sellable (Bins 1-3)', 'Scrap (Bins 4-8)'],
        digits=4
    )
    print(binary_report)

    # 3. Save classification report with leakage controls
    report_path = os.path.join(out_results, "classification_report.txt")
    with open(report_path, "w") as f:
        f.write("Supervised LightGBM — Micron Backend Assembly Dataset\n")
        f.write("=" * 50 + "\n\n")
        f.write("LEAKAGE CONTROLS APPLIED:\n")
        f.write("  Split:               train(64%) / val(16%) / test(20%)\n")
        f.write("  StandardScaler:       fitted on train only\n")
        f.write("  class_weight:         'balanced' (no SMOTE needed)\n")
        f.write("  Threshold tuning:     empirically via PR curve on val set\n")
        f.write("                        optimal_threshold = argmax(F1)\n")
        f.write("                        NOT manually set\n")
        f.write("  Final evaluation:     test set only\n\n")
        f.write("MULTICLASS CLASSIFICATION REPORT:\n")
        f.write(multiclass_report)
        f.write("\nBINARY CLASSIFICATION REPORT:\n")
        f.write(binary_report)
    print(f"Saved: {report_path}")

    # 4. Confusion matrix (multiclass)
    cm = confusion_matrix(y_true, y_pred_classes)
    fig, ax = plt.subplots(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=[f'Bin {i}' for i in range(1, 9)],
                yticklabels=[f'Bin {i}' for i in range(1, 9)],
                ax=ax)
    ax.set_title("LightGBM — Confusion Matrix (Multiclass)\n(Evaluated on Held-Out Test Set)")
    ax.set_ylabel('True Bin')
    ax.set_xlabel('Predicted Bin')
    plt.tight_layout()
    cm_plot_path = os.path.join(out_plots, 'confusion_matrix.png')
    fig.savefig(cm_plot_path, dpi=150)
    plt.close(fig)
    print(f"Saved: {cm_plot_path}")

    # 5. ROC curve & AUC (binary)
    fpr_roc, tpr_roc, _ = roc_curve(y_true_binary, df_results["lgb_risk_score"] / 100.0)
    roc_auc = auc(fpr_roc, tpr_roc)

    fig, ax = plt.subplots(figsize=(7, 6))
    ax.plot(fpr_roc, tpr_roc, color='darkorange', lw=2,
            label=f'ROC curve (AUC = {roc_auc:.4f})')
    ax.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
    ax.set_xlim([0.0, 1.0])
    ax.set_ylim([0.0, 1.05])
    ax.set_xlabel('False Positive Rate')
    ax.set_ylabel('True Positive Rate')
    ax.set_title('Receiver Operating Characteristic (ROC)')
    ax.legend(loc="lower right")
    plt.grid(alpha=0.3)
    plt.tight_layout()
    roc_plot_path = os.path.join(out_plots, "roc_curve.png")
    fig.savefig(roc_plot_path, dpi=150)
    plt.close(fig)
    print(f"Saved: {roc_plot_path}")
    print(f"ROC AUC Score: {roc_auc:.4f}")

    # Append AUC to report
    with open(report_path, "a") as f:
        f.write(f"\nROC AUC Score: {roc_auc:.4f}\n")

    # 6. Risk score distribution
    fig, ax = plt.subplots(figsize=(10, 5))
    ax.hist(
        df_results.loc[df_results["is_defective"] == 0, "lgb_risk_score"],
        bins=80, alpha=0.6, label="Sellable", color="steelblue", density=True
    )
    ax.hist(
        df_results.loc[df_results["is_defective"] == 1, "lgb_risk_score"],
        bins=80, alpha=0.7, label="Scrap", color="red", density=True
    )
    ax.set_xlabel("Risk Score (0-100)")
    ax.set_ylabel("Density")
    ax.set_title("LightGBM Risk Score Distribution by Class (Test Set)")
    ax.legend()
    plt.tight_layout()
    dist_plot_path = os.path.join(out_plots, "risk_score_distribution.png")
    fig.savefig(dist_plot_path, dpi=150)
    plt.close(fig)
    print(f"Saved: {dist_plot_path}")

    # 7. Top 10 highest-risk defects
    top10 = df_results.nlargest(10, "lgb_risk_score")
    top10_path = os.path.join(out_results, "top10_defects.csv")
    top10.to_csv(top10_path, index=False)
    print(f"Saved: {top10_path}")

    # 8. Save all predicted defects
    predicted_defects = df_results[df_results['lgb_prediction'] == 1]
    defects_path = os.path.join(out_results, "predicted_defects.csv")
    predicted_defects.to_csv(defects_path, index=False)
    print(f"Saved {len(predicted_defects):,} predicted defects to: {defects_path}")


def plot_feature_importance(importance_series: pd.Series, out_plots: str):
    """
    Native LightGBM importances — no SHAP here.
    Horizontal bar chart. Color Top 3 red, 4-8 orange, rest steelblue.
    """
    fig, ax = plt.subplots(figsize=(10, 8))
    
    colors = []
    for i in range(len(importance_series)):
        if i < 3:
            colors.append('red')
        elif i < 8:
            colors.append('orange')
        else:
            colors.append('steelblue')

    importance_series.sort_values(ascending=True).plot(
        kind='barh', ax=ax, color=colors[::-1]
    )
    
    ax.set_xlabel('Importance Score')
    ax.set_title('LightGBM Feature Importance')
    plt.tight_layout()
    
    feat_plot_path = os.path.join(out_plots, 'feature_importance.png')
    fig.savefig(feat_plot_path, dpi=150)
    plt.close(fig)
    print(f"Saved: {feat_plot_path}")
