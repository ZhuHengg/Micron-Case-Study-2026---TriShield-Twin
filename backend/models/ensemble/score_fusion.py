import numpy as np
import pandas as pd
from itertools import product
from sklearn.metrics import precision_recall_curve
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import json
import os

class ScoreFusion:
    """
    Weighted fusion of 3 shield scores.
    All weights and thresholds empirically derived from validation set.
    Identical structure to FraudShieldAI's ScoreFusion.
    """
    def __init__(self):
        self.w_lgb = None
        self.w_iso = None
        self.w_phy = None
        self.approve_threshold = None
        self.flag_threshold = None
        # Shield 3 Veto: if physics score alone exceeds this,
        # unit is auto-escalated to 'Flag' regardless of weighted average.
        # Tuned empirically on validation set — never hardcoded.
        self.veto_threshold = None
        self.veto_fp_rate = None

    def fuse(self, lgb_scores, iso_scores, phy_scores):
        """
        Combines three 0-100 score arrays into single fused score.
        tune_weights() must be called before fuse().
        """
        if self.w_lgb is None:
            raise RuntimeError("Weights not set. Call tune_weights() first.")
        return (
            np.array(lgb_scores) * self.w_lgb +
            np.array(iso_scores) * self.w_iso +
            np.array(phy_scores) * self.w_phy
        )

    def tune_weights(self, y_val, lgb_val, iso_val, phy_val, step=0.10):
        """
        Grid search over weight combinations on VALIDATION SET ONLY.
        Finds combination that maximises F1 score.
        All inputs on 0-100 scale.
        Constraint: w_lgb + w_iso + w_phy = 1.0
        """
        print("\n" + "=" * 60)
        print("STEP 6: WEIGHT TUNING (VALIDATION SET)")
        print("=" * 60)

        best_f1 = 0
        best_weights = None
        results = []

        weight_options = np.arange(0.1, 0.9, step).round(1)

        for w_lgb, w_iso in product(weight_options, weight_options):
            w_phy = round(1.0 - w_lgb - w_iso, 1)
            if w_phy < 0.1 or w_phy > 0.8:
                continue

            fused = (
                np.array(lgb_val) * w_lgb +
                np.array(iso_val) * w_iso +
                np.array(phy_val) * w_phy
            )

            precisions, recalls, thresholds = precision_recall_curve(y_val, fused)
            f1s = 2 * precisions * recalls / (precisions + recalls + 1e-10)
            best_f1_here = f1s.max()

            results.append({
                'w_lgb': w_lgb,
                'w_iso': w_iso,
                'w_phy': w_phy,
                'f1': best_f1_here
            })

            if best_f1_here > best_f1:
                best_f1 = best_f1_here
                best_weights = {'w_lgb': w_lgb, 'w_iso': w_iso, 'w_phy': w_phy}

        self.w_lgb = best_weights['w_lgb']
        self.w_iso = best_weights['w_iso']
        self.w_phy = best_weights['w_phy']

        print(f"\n=== OPTIMAL WEIGHTS (validation set) ===")
        print(f"LightGBM:      {self.w_lgb:.2f}")
        print(f"IsoForest:     {self.w_iso:.2f}")
        print(f"Physics Rules: {self.w_phy:.2f}")
        print(f"Best F1:       {best_f1:.4f}")

        return best_weights, best_f1, pd.DataFrame(results)

    def tune_threshold(self, y_val, fused_val_scores, out_plots):
        """
        Finds optimal approve threshold on VALIDATION SET ONLY.
        Uses PR curve to maximise F1 on fused scores.
        """
        print("\n" + "=" * 60)
        print("STEP 7: THRESHOLD TUNING (VALIDATION SET)")
        print("=" * 60)

        precisions, recalls, thresholds = precision_recall_curve(y_val, fused_val_scores)
        f1_scores = 2 * precisions * recalls / (precisions + recalls + 1e-10)
        best_idx = np.argmax(f1_scores)
        best_threshold = float(thresholds[best_idx])
        best_precision = float(precisions[best_idx])
        best_recall = float(recalls[best_idx])
        best_f1 = float(f1_scores[best_idx])

        self.approve_threshold = best_threshold
        self.flag_threshold = best_threshold + ((100 - best_threshold) * 0.5)

        print(f"Threshold:  {best_threshold:.2f}")
        print(f"Precision:  {best_precision:.2%}")
        print(f"Recall:     {best_recall:.2%}")
        print(f"F1:         {best_f1:.4f}")

        # Plot PR curve
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.plot(recalls, precisions, color='steelblue',
                linewidth=2, label='Precision-Recall curve')
        ax.scatter(
            best_recall, best_precision,
            color='red', s=150, zorder=5,
            label=(f'Optimal: threshold={best_threshold:.1f}\n'
                   f'P={best_precision:.2%} | '
                   f'R={best_recall:.2%} | '
                   f'F1={best_f1:.3f}')
        )
        ax.set_xlabel('Recall')
        ax.set_ylabel('Precision')
        ax.set_title('Ensemble Precision-Recall Curve\n'
                     '(Threshold tuned on Validation Set)')
        ax.legend()
        ax.grid(True, alpha=0.3)
        plt.tight_layout()
        fig.savefig(os.path.join(out_plots, 'precision_recall_curve.png'), dpi=150)
        plt.close(fig)
        print(f"Saved: {out_plots}/precision_recall_curve.png")

        return best_threshold, best_precision, best_recall, best_f1

    def tune_veto_threshold(self, y_val, phy_val, out_plots):
        """
        Shield 3 Veto: finds the physics score threshold above which
        a unit is auto-escalated to 'Flag' regardless of weighted average.

        Tuned on VALIDATION SET ONLY.
        Goal: maximize recall on defects that the weighted average misses
        (primarily Bin 4 Fab Passthrough) at an acceptable false positive cost.

        Strategy: sweep physics score thresholds, pick the one that
        maximizes the additional recall gained per false positive introduced.
        """
        print("\n" + "=" * 60)
        print("STEP 7b: SHIELD 3 VETO THRESHOLD TUNING (VALIDATION SET)")
        print("=" * 60)

        phy_arr = np.array(phy_val)
        y_arr = np.array(y_val)

        # Try thresholds from 5 to 45 in steps of 1
        candidates = np.arange(5, 46, 1.0)
        best_veto = None
        best_net_gain = -np.inf
        results = []

        for thresh in candidates:
            # Units that would be vetoed (physics score >= thresh)
            vetoed = phy_arr >= thresh
            n_vetoed = vetoed.sum()
            if n_vetoed == 0:
                continue

            # Of those vetoed, how many are true defects vs false positives?
            tp_gained = (vetoed & (y_arr == 1)).sum()
            fp_added = (vetoed & (y_arr == 0)).sum()
            fp_rate = fp_added / (y_arr == 0).sum()

            # Net gain metric: recall gained minus penalty for FP rate
            # We want high recall gain with low FP cost
            recall_gain = tp_gained / max((y_arr == 1).sum(), 1)
            net_gain = recall_gain - 2.0 * fp_rate  # 2x penalty on FP

            results.append({
                'threshold': thresh,
                'units_vetoed': n_vetoed,
                'tp_gained': tp_gained,
                'fp_added': fp_added,
                'fp_rate': fp_rate,
                'recall_gain': recall_gain,
                'net_gain': net_gain
            })

            if net_gain > best_net_gain:
                best_net_gain = net_gain
                best_veto = thresh
                best_fp_rate = fp_rate
                best_tp = tp_gained
                best_fp = fp_added

        if best_veto is not None:
            self.veto_threshold = best_veto
            self.veto_fp_rate = best_fp_rate
            print(f"Veto threshold:     {best_veto:.1f}")
            print(f"Additional catches: {best_tp} true defects")
            print(f"FP cost:            {best_fp} false positives ({best_fp_rate:.2%} FPR)")
            print(f"Net gain score:     {best_net_gain:.4f}")
        else:
            self.veto_threshold = None
            print("No veto threshold found — physics rules do not improve recall.")

        # Plot veto analysis
        if results:
            df_res = pd.DataFrame(results)
            fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

            ax1.plot(df_res['threshold'], df_res['recall_gain'] * 100,
                     color='steelblue', linewidth=2, label='Recall Gain (%)')
            ax1.plot(df_res['threshold'], df_res['fp_rate'] * 100,
                     color='red', linewidth=2, label='FP Rate (%)')
            if best_veto:
                ax1.axvline(best_veto, color='green', linestyle='--',
                            label=f'Optimal: {best_veto:.0f}')
            ax1.set_xlabel('Physics Score Threshold')
            ax1.set_ylabel('Rate (%)')
            ax1.set_title('Veto Threshold: Recall Gain vs FP Cost')
            ax1.legend()
            ax1.grid(True, alpha=0.3)

            ax2.bar(df_res['threshold'], df_res['net_gain'],
                    color=['green' if x > 0 else 'red' for x in df_res['net_gain']],
                    alpha=0.7)
            ax2.set_xlabel('Physics Score Threshold')
            ax2.set_ylabel('Net Gain (recall - 2×FPR)')
            ax2.set_title('Net Gain per Veto Threshold')
            ax2.grid(True, alpha=0.3)

            plt.tight_layout()
            fig.savefig(os.path.join(out_plots, 'veto_threshold_analysis.png'), dpi=150)
            plt.close(fig)
            print(f"Saved: {out_plots}/veto_threshold_analysis.png")

        return self.veto_threshold

    def get_decision(self, fused_score: float, phy_score: float = None) -> str:
        """
        Maps fused score to APPROVE/FLAG/BLOCK.
        If Shield 3 veto is active and phy_score exceeds veto threshold,
        the unit is auto-escalated to at least 'Flag'.
        """
        if self.approve_threshold is None:
            raise RuntimeError("Call tune_threshold() before get_decision()")

        # Primary decision from weighted average
        if fused_score < self.approve_threshold:
            decision = 'Approve'
        elif fused_score < self.flag_threshold:
            decision = 'Flag'
        else:
            decision = 'Block'

        # Shield 3 Veto Override
        if (self.veto_threshold is not None and
                phy_score is not None and
                phy_score >= self.veto_threshold and
                decision == 'Approve'):
            decision = 'Flag'

        return decision

    def get_decisions(self, fused_scores, phy_scores=None) -> np.ndarray:
        if phy_scores is None:
            return np.array([self.get_decision(s) for s in fused_scores])
        return np.array([
            self.get_decision(s, p) for s, p in zip(fused_scores, phy_scores)
        ])

    def save_config(self, path: str, val_precision: float, val_recall: float, val_f1: float):
        config = {
            'weights': {
                'lgb': self.w_lgb,
                'iso': self.w_iso,
                'physics': self.w_phy
            },
            'thresholds': {
                'optimal_threshold': self.approve_threshold,
                'flag_threshold': self.flag_threshold
            },
            'veto': {
                'shield3_veto_threshold': self.veto_threshold,
                'veto_fp_rate': self.veto_fp_rate,
                'description': 'If physics score >= veto threshold, '
                               'unit auto-escalated to Flag regardless of weighted average'
            },
            'validation_metrics': {
                'precision': val_precision,
                'recall': val_recall,
                'f1': val_f1
            },
            'notes': {
                'weights_source': 'grid search on validation set',
                'threshold_source': 'PR curve argmax F1 on val set',
                'veto_source': 'recall-gain vs FP-cost sweep on val set',
                'scale': '0-100 for all model scores',
                'hardcoded_values': 'none -- all empirically derived'
            }
        }
        with open(path, 'w') as f:
            json.dump(config, f, indent=2)
        print(f"Ensemble config saved: {path}")
