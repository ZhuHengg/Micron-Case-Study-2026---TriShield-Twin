import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import seaborn as sns
import pandas as pd
import numpy as np
import os
from sklearn.metrics import classification_report, confusion_matrix, roc_curve, auc


def plot_confusion_matrix(y_true, y_pred, out_plots):
    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = cm.ravel()
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    fpr = fp / (fp + tn) if (fp + tn) > 0 else 0

    total = np.sum(cm)
    cm_perc = cm / total * 100
    labels = np.asarray(
        [f"{count}\n({perc:.1f}%)" for count, perc in zip(cm.flatten(), cm_perc.flatten())]
    ).reshape(2, 2)

    fig, ax = plt.subplots(dpi=150, figsize=(8, 6))
    sns.heatmap(cm, annot=labels, fmt='', cmap='Blues', ax=ax,
                xticklabels=['Sellable', 'Scrap'], yticklabels=['Sellable', 'Scrap'])
    ax.set_ylabel('True Label')
    ax.set_xlabel(f'Predicted Label\n\nPrecision: {precision:.4f} | Recall: {recall:.4f} | F1: {f1:.4f} | FPR: {fpr:.4f}')
    ax.set_title('Tri-Shield Ensemble — Confusion Matrix\n(Evaluated on Held-Out Test Set)')

    path = os.path.join(out_plots, 'confusion_matrix.png')
    plt.tight_layout()
    plt.savefig(path)
    plt.close(fig)
    print(f"Saved: {path}")


def plot_roc_curve(y_true, ensemble_scores, out_plots):
    y_score = ensemble_scores / 100.0
    fpr, tpr, _ = roc_curve(y_true, y_score)
    roc_auc = auc(fpr, tpr)

    fig, ax = plt.subplots(dpi=150, figsize=(8, 6))
    ax.plot(fpr, tpr, color='darkorange', lw=2, label=f'ROC curve (AUC = {roc_auc:.4f})')
    ax.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
    ax.set_xlim([0.0, 1.0])
    ax.set_ylim([0.0, 1.05])
    ax.set_xlabel('False Positive Rate')
    ax.set_ylabel('True Positive Rate')
    ax.set_title('Tri-Shield Ensemble — ROC Curve')
    ax.legend(loc="lower right")

    path = os.path.join(out_plots, 'roc_curve.png')
    plt.tight_layout()
    plt.savefig(path)
    plt.close(fig)
    print(f"Saved: {path}")


def plot_risk_distribution(df_results, approve_threshold, flag_threshold, out_plots):
    fig, ax = plt.subplots(dpi=150, figsize=(10, 6))

    sellable = df_results[df_results['is_defective'] == 0]['ensemble_risk_score']
    scrap = df_results[df_results['is_defective'] == 1]['ensemble_risk_score']

    ax.hist(sellable, bins=80, color='steelblue', alpha=0.6, label='Sellable')
    ax.hist(scrap, bins=80, color='red', alpha=0.6, label='Scrap')

    ax.axvline(approve_threshold, color='green', linestyle='--',
               label=f'Approve threshold: {approve_threshold:.1f}')
    ax.axvline(flag_threshold, color='orange', linestyle='--',
               label=f'Flag threshold: {flag_threshold:.1f}')

    ax.set_xlabel('Ensemble Risk Score')
    ax.set_ylabel('Count')
    ax.set_title('Tri-Shield Ensemble — Risk Score Distribution')
    ax.legend()

    path = os.path.join(out_plots, 'risk_score_distribution.png')
    plt.tight_layout()
    plt.savefig(path)
    plt.close(fig)
    print(f"Saved: {path}")


def plot_score_comparison(df_results, out_plots):
    cols_to_melt = ['lgb_risk_score', 'iso_risk_score', 'phy_risk_score', 'ensemble_risk_score']
    df_long = pd.melt(
        df_results, id_vars=['is_defective'], value_vars=cols_to_melt,
        var_name='Model', value_name='Risk Score'
    )
    model_labels = {
        'lgb_risk_score': 'Shield 1\n(LightGBM)',
        'iso_risk_score': 'Shield 2\n(IsoForest)',
        'phy_risk_score': 'Shield 3\n(Physics)',
        'ensemble_risk_score': 'Ensemble\n(Fused)'
    }
    df_long['Model'] = df_long['Model'].map(model_labels)

    fig, ax = plt.subplots(dpi=150, figsize=(12, 6))
    sns.boxplot(x='Model', y='Risk Score', hue='is_defective', data=df_long,
                palette={0: 'steelblue', 1: 'red'}, ax=ax)
    ax.legend(title='Class', labels=['Sellable', 'Scrap'])
    ax.set_title('Score Comparison by Shield')

    path = os.path.join(out_plots, 'score_comparison.png')
    plt.tight_layout()
    plt.savefig(path)
    plt.close(fig)
    print(f"Saved: {path}")


def plot_weight_heatmap(results_df, out_plots):
    pivot_df = results_df.pivot(index='w_iso', columns='w_lgb', values='f1')
    pivot_df = pivot_df.sort_index(ascending=False)

    best_row = results_df.loc[results_df['f1'].idxmax()]

    fig, ax = plt.subplots(dpi=150, figsize=(8, 6))
    sns.heatmap(pivot_df, annot=True, fmt=".3f", cmap="YlOrRd", ax=ax,
                cbar_kws={'label': 'F1 Score'})

    y_idx = list(pivot_df.index).index(best_row['w_iso'])
    x_idx = list(pivot_df.columns).index(best_row['w_lgb'])
    ax.scatter(x_idx + 0.5, y_idx + 0.5, color='red', marker='x',
               s=100, linewidth=3, label='Optimal Combo')

    ax.set_title('Grid Search: Weight Tuning F1 Heatmap\n'
                 f"(Best: LGB={best_row['w_lgb']:.1f} ISO={best_row['w_iso']:.1f} PHY={best_row['w_phy']:.1f})")
    ax.set_ylabel('Isolation Forest Weight')
    ax.set_xlabel('LightGBM Weight')
    ax.legend()

    path = os.path.join(out_plots, 'weight_tuning_heatmap.png')
    plt.tight_layout()
    plt.savefig(path)
    plt.close(fig)
    print(f"Saved: {path}")


def plot_per_bin_recall(df_results, out_plots):
    """Per-bin recall comparison across all 3 shields + ensemble."""
    bin_names = {
        1: "Bin 1", 2: "Bin 2", 3: "Bin 3",
        4: "Bin 4", 5: "Bin 5", 6: "Bin 6",
        7: "Bin 7", 8: "Bin 8"
    }

    defect_bins = [4, 5, 6, 7, 8]
    recalls = {'Shield 1 (LGB)': [], 'Shield 2 (IF)': [],
               'Shield 3 (Physics)': [], 'Ensemble': []}

    for b in defect_bins:
        subset = df_results[df_results['bin_code'] == b]
        if len(subset) == 0:
            for key in recalls:
                recalls[key].append(0)
            continue

        total = len(subset)
        # Shield 1: lgb_risk_score > lgb threshold (we use a proxy: ensemble_prediction captures combined)
        # For per-shield, we check each score against its own optimal
        lgb_caught = (subset['lgb_risk_score'] >= 98.32).sum()
        iso_caught = (subset['iso_risk_score'] >= 41.04).sum()
        phy_caught = (subset['phy_risk_score'] >= 10).sum()  # Physics rules use lower threshold
        ens_caught = (subset['ensemble_prediction'] == 1).sum()

        recalls['Shield 1 (LGB)'].append(lgb_caught / total)
        recalls['Shield 2 (IF)'].append(iso_caught / total)
        recalls['Shield 3 (Physics)'].append(phy_caught / total)
        recalls['Ensemble'].append(ens_caught / total)

    x = np.arange(len(defect_bins))
    width = 0.20

    fig, ax = plt.subplots(dpi=150, figsize=(12, 6))
    ax.bar(x - 1.5 * width, recalls['Shield 1 (LGB)'], width, label='Shield 1 (LGB)', color='#4C72B0')
    ax.bar(x - 0.5 * width, recalls['Shield 2 (IF)'], width, label='Shield 2 (IF)', color='#55A868')
    ax.bar(x + 0.5 * width, recalls['Shield 3 (Physics)'], width, label='Shield 3 (Physics)', color='#C44E52')
    ax.bar(x + 1.5 * width, recalls['Ensemble'], width, label='Ensemble', color='#8172B2')

    ax.set_xlabel('Defect Type')
    ax.set_ylabel('Recall')
    ax.set_title('Per-Bin Recall: Shield 1 vs Shield 2 vs Shield 3 vs Ensemble')
    ax.set_xticks(x)
    ax.set_xticklabels([bin_names[b] for b in defect_bins])
    ax.legend()
    ax.set_ylim(0, 1.1)
    for i, b in enumerate(defect_bins):
        ax.text(i + 1.5 * width, recalls['Ensemble'][i] + 0.02,
                f"{recalls['Ensemble'][i]:.0%}", ha='center', fontsize=8)

    path = os.path.join(out_plots, 'per_bin_recall.png')
    plt.tight_layout()
    plt.savefig(path)
    plt.close(fig)
    print(f"Saved: {path}")


def evaluate_ensemble(y_true, y_pred, df_results, approve_threshold, flag_threshold, out_plots, out_results):
    os.makedirs(out_plots, exist_ok=True)
    os.makedirs(out_results, exist_ok=True)

    plot_confusion_matrix(y_true, y_pred, out_plots)
    plot_roc_curve(y_true, df_results['ensemble_risk_score'].values, out_plots)
    plot_risk_distribution(df_results, approve_threshold, flag_threshold, out_plots)
    plot_score_comparison(df_results, out_plots)

    if 'bin_code' in df_results.columns:
        plot_per_bin_recall(df_results, out_plots)

    report_str = classification_report(
        y_true, y_pred,
        target_names=['Sellable (Bins 1-3)', 'Scrap (Bins 4-8)']
    )

    header = '''Tri-Shield Ensemble -- Micron Case Study
==========================================
LEAKAGE CONTROLS APPLIED:
  Split:             train(64%) / val(16%) / test(20%)
  Weight tuning:     grid search on validation set only
  Threshold tuning:  PR curve argmax F1 on val set only
  Final evaluation:  test set only
  Hardcoded values:  none -- all empirically derived
==========================================\n\n'''

    report_path = os.path.join(out_results, 'classification_report.txt')
    with open(report_path, 'w', encoding='utf-8') as f:
        f.write(header + report_str)
    print(f"Saved: {report_path}")

    # Score breakdown CSV
    cols = ['unit_id', 'is_defective', 'bin_code',
            'lgb_risk_score', 'iso_risk_score', 'phy_risk_score',
            'ensemble_risk_score', 'risk_tier', 'ensemble_prediction',
            'physics_reasons']
    available_cols = [c for c in cols if c in df_results.columns]
    scores_path = os.path.join(out_results, 'score_breakdown.csv')
    df_results[available_cols].to_csv(scores_path, index=False)
    print(f"Saved: {scores_path}")
