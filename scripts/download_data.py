"""Download English + Italian sentiment data from Hugging Face.

Run:  python scripts/download_data.py
Needs internet. Roman Urdu data is downloaded manually (see README).
"""
from pathlib import Path
from datasets import load_dataset

OUT = Path("data/raw")
OUT.mkdir(parents=True, exist_ok=True)

# Multilingual sentiment collection (positive / neutral / negative)
for lang in ["english", "italian"]:
    ds = load_dataset("tyqiangz/multilingual-sentiments", lang)
    for split in ds:
        path = OUT / f"{lang}_{split}.csv"
        ds[split].to_pandas().to_csv(path, index=False)
        print("saved", path, len(ds[split]))
