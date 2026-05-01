import pandas as pd
import numpy as np

print("=" * 60)
print("EVALUATION: synthetic_backend_assembly.csv")
print("=" * 60)

df = pd.read_csv('data/synthetic_backend_assembly.csv')
print(f"Shape: {df.shape}")
print(f"Columns ({len(df.columns)}): {list(df.columns)}")
print(f"\nNull count: {df.isnull().sum().sum()} total nulls")

print("\n--- RRS Monotonic Check ---")
mono = (
    (df['rrs_1'] <= df['rrs_2'] + 0.001) &
    (df['rrs_2'] <= df['rrs_3'] + 0.001) &
    (df['rrs_3'] <= df['rrs_4'] + 0.001) &
    (df['rrs_4'] <= df['rrs_5'] + 0.001)
).mean()
print(f"  {mono*100:.2f}% of rows are monotonically increasing")

print("\n--- RRS Ranges ---")
for c in ['rrs_1','rrs_2','rrs_3','rrs_4','rrs_5']:
    print(f"  {c}: [{df[c].min():.4f}, {df[c].max():.4f}] avg={df[c].mean():.4f}")

print("\n--- Avg RRS by Defect Status ---")
print(df.groupby('is_defective')[['rrs_1','rrs_2','rrs_3','rrs_4','rrs_5']].mean().round(4))

print("\n--- Bin Distribution ---")
print(df['bin_code'].value_counts(normalize=True).sort_index().round(4) * 100)

print("\n--- is_defective column ---")
print(f"  Present: {'is_defective' in df.columns}")
if 'is_defective' in df.columns:
    print(f"  Values: {df['is_defective'].value_counts().to_dict()}")

m = pd.read_csv('data/machines.csv')

print("\n--- Degraded vs Healthy Defect Rate (ALL stages) ---")
for stage_col, stage_name in [('machine_db','die_bonder'), ('machine_wb','wire_bonder'),
                               ('machine_mp','mold_press'), ('machine_ba','ball_attach'),
                               ('machine_sw','saw')]:
    degraded_ids = set(m[(m['pool']=='degraded') & (m['machine_type']==stage_name)]['machine_id'])
    is_deg = df[stage_col].isin(degraded_ids)
    deg_rate = df.loc[is_deg, 'is_defective'].mean()
    hlt_rate = df.loc[~is_deg, 'is_defective'].mean()
    arrow = ">" if deg_rate > hlt_rate else "<"
    status = "CORRECT" if deg_rate > hlt_rate else "WRONG"
    print(f"  {stage_name:15s}: degraded={deg_rate:.4f} {arrow} healthy={hlt_rate:.4f}  [{status}]")

print("\n" + "=" * 60)
print("EVALUATION: machines.csv")
print("=" * 60)
print(f"Shape: {m.shape}")
print(f"\nMachine counts by type/pool:")
print(m.groupby(['machine_type','pool']).size().unstack(fill_value=0))
print(f"\nAvg risk score by type/pool:")
print(m.groupby(['machine_type','pool'])['machine_risk_score'].mean().unstack().round(4))
print(f"\nDegraded should have HIGHER risk than healthy!")
for mt in m['machine_type'].unique():
    sub = m[m['machine_type']==mt]
    deg_avg = sub[sub['pool']=='degraded']['machine_risk_score'].mean()
    hlt_avg = sub[sub['pool']=='healthy']['machine_risk_score'].mean()
    status = "CORRECT" if deg_avg > hlt_avg else "WRONG"
    print(f"  {mt:15s}: degraded={deg_avg:.4f} vs healthy={hlt_avg:.4f}  [{status}]")

print(f"\nZero risk count: {(m['machine_risk_score'] == 0.0).sum()}")
print(f"Risk range: [{m['machine_risk_score'].min()}, {m['machine_risk_score'].max()}]")
