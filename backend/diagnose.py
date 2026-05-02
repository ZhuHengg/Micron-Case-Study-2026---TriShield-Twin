"""Quick diagnostic to find why the Tri-Shield engine fails to load."""
import sys, os, traceback

print("=" * 60)
print("Tri-Shield Engine Diagnostic")
print("=" * 60)

# Step 1: Check model files exist
paths = {
    'ISO model': 'models/unsupervised/outputs/model/isolation_forest_model.pkl',
    'ISO scaler': 'models/unsupervised/outputs/model/scaler.pkl',
    'ISO minmax': 'models/unsupervised/outputs/model/minmax_scaler.pkl',
    'LGB model': 'models/supervised/outputs/model/lgb_model.pkl',
    'LGB scaler': 'models/supervised/outputs/model/scaler.pkl',
    'Ensemble cfg': 'models/ensemble/outputs/model/ensemble_config.json',
    'Physics rules': 'models/ensemble/physics_rules.py',
}

print("\n[1] Checking model files...")
for name, path in paths.items():
    exists = os.path.exists(path)
    size = os.path.getsize(path) if exists else 0
    status = f"OK ({size:,} bytes)" if exists else "MISSING"
    print(f"  {name:20s} -> {status}")

# Step 2: Try loading each component
print("\n[2] Loading Isolation Forest...")
try:
    import joblib
    iso = joblib.load('models/unsupervised/outputs/model/isolation_forest_model.pkl')
    print(f"  OK: {type(iso)}")
except Exception as e:
    print(f"  FAIL: {e}")

print("\n[3] Loading LightGBM...")
try:
    lgb = joblib.load('models/supervised/outputs/model/lgb_model.pkl')
    print(f"  OK: {type(lgb)}")
except Exception as e:
    print(f"  FAIL: {e}")

print("\n[4] Loading ensemble_config.json...")
try:
    import json
    with open('models/ensemble/outputs/model/ensemble_config.json') as f:
        cfg = json.load(f)
    print(f"  OK: keys = {list(cfg.keys())}")
    print(f"  weights: {cfg.get('weights')}")
    print(f"  thresholds: {cfg.get('thresholds')}")
    print(f"  veto: {cfg.get('veto')}")
except Exception as e:
    print(f"  FAIL: {e}")

print("\n[5] Loading PhysicsRuleEngine...")
try:
    physics_dir = os.path.abspath(os.path.join('models/ensemble/outputs/model', '..', '..'))
    print(f"  physics_dir resolved to: {physics_dir}")
    print(f"  physics_rules.py exists there: {os.path.exists(os.path.join(physics_dir, 'physics_rules.py'))}")
    sys.path.insert(0, physics_dir)
    from physics_rules import PhysicsRuleEngine
    phy = PhysicsRuleEngine()
    print(f"  OK: {type(phy)}")
except Exception as e:
    print(f"  FAIL: {e}")
    traceback.print_exc()

print("\n[6] Full EnsembleEngine init...")
try:
    from api.inference import EnsembleEngine
    engine = EnsembleEngine(
        iso_model_dir='models/unsupervised/outputs/model',
        lgb_model_dir='models/supervised/outputs/model',
        ensemble_dir='models/ensemble/outputs/model'
    )
    print(f"  OK: engine loaded, explainer = {engine.explainer is not None}")
except Exception as e:
    print(f"  FAIL: {e}")
    traceback.print_exc()

print("\n" + "=" * 60)
print("Diagnostic complete.")
