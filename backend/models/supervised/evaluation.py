import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix, precision_recall_curve
import numpy as np
import os

def tune_threshold(y_true, risk_scores, output_dir):
    """
    y_true is multiclass (0-7). We map it to binary (0 for pass, 1 for fail)
    where classes 0, 1, 2 are PASS, and 3, 4, 5, 6, 7 are FAIL.
    risk_scores are 0-100.
    """
    print("\n" + "="*50)
    print("EMPIRICAL THRESHOLD TUNING (ON VALIDATION SET)")
    print("="*50)
    
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
    print(f"Validation F1 at threshold: {best_f1:.4f}")
    
    # Plot PR curve
    plt.figure(figsize=(8, 6))
    plt.plot(recalls, precisions, label='PR Curve', color='blue')
    plt.scatter(best_recall, best_precision, color='red', s=100, label=f'Optimal (F1={best_f1:.2f})')
    plt.xlabel('Recall')
    plt.ylabel('Precision')
    plt.title('Validation PR Curve (Defect Prediction)')
    plt.legend()
    plt.savefig(os.path.join(output_dir, 'pr_curve.png'))
    plt.close()
    
    return best_threshold, best_precision, best_recall, best_f1

def evaluate_predictions(y_true, y_pred_classes, y_pred_binary, output_dir):
    print("\n=== MULTICLASS PERFORMANCE (BINS 1-8) ===")
    print(classification_report(y_true, y_pred_classes, target_names=[f'Bin {i}' for i in range(1, 9)]))
    
    plt.figure(figsize=(10, 8))
    cm = confusion_matrix(y_true, y_pred_classes)
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=[f'Bin {i}' for i in range(1, 9)],
                yticklabels=[f'Bin {i}' for i in range(1, 9)])
    plt.title("Confusion Matrix (Multiclass)")
    plt.ylabel('True Bin')
    plt.xlabel('Predicted Bin')
    plt.savefig(os.path.join(output_dir, 'confusion_matrix.png'))
    plt.close()

    print("\n=== BINARY PERFORMANCE (SELLABLE VS SCRAP) ===")
    y_true_binary = (y_true >= 3).astype(int)
    print(classification_report(y_true_binary, y_pred_binary, target_names=['Sellable (Bins 1-3)', 'Scrap (Bins 4-8)']))
