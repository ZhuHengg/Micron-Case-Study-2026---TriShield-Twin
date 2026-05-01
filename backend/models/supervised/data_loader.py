import pandas as pd
import time
import os
from sklearn.model_selection import train_test_split

def split_data(df: pd.DataFrame, test_size: float = 0.2, val_size: float = 0.2, random_state: int = 42):
    """
    Splits the dataframe into train, validation and test sets.
    Stratified by bin_code to preserve multiclass representation (rare defects).
    """
    print("\n" + "="*50)
    print("BUILDING THE WALL — TRAIN/VAL/TEST SPLIT")
    print("="*50)

    # First split: carve out test set
    df_train_full, df_test = train_test_split(
        df,
        test_size=test_size,
        random_state=random_state,
        stratify=df['bin_code']
    )

    # Second split: carve validation from remaining train
    df_train, df_val = train_test_split(
        df_train_full,
        test_size=val_size,
        random_state=random_state,
        stratify=df_train_full['bin_code']
    )

    df_train = df_train.reset_index(drop=True)
    df_val   = df_val.reset_index(drop=True)
    df_test  = df_test.reset_index(drop=True)

    total = len(df)
    print(f"Train: {len(df_train):,} ({len(df_train)/total*100:.0f}%)")
    print(f"Val:   {len(df_val):,} ({len(df_val)/total*100:.0f}%)")
    print(f"Test:  {len(df_test):,} ({len(df_test)/total*100:.0f}%)")

    return df_train, df_val, df_test

def load_data(data_path: str) -> pd.DataFrame:
    print("=" * 60)
    print("STEP 1: LOAD DATA")
    print("=" * 60)

    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Dataset not found at: {data_path}")

    print("Loading dataset...")
    start = time.time()
    df = pd.read_csv(data_path)

    print(f"Shape: {df.shape}")
    print(f"Loaded in {time.time()-start:.1f}s\n")

    return df
