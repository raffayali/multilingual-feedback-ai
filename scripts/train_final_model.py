"""Train the final sentiment model and save it for the app.

Run from the project root:  python scripts/train_final_model.py
Needs data/raw/roman_urdu.csv. Creates models/sentiment_tfidf.joblib and models/metrics.json
"""
import json
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split

from src.model import build_pipeline, load_roman_urdu, save_model

DATA = Path("data/raw/roman_urdu.csv")
OUT_MODEL = Path("models/sentiment_tfidf.joblib")
OUT_METRICS = Path("models/metrics.json")

df = load_roman_urdu(DATA)
train, test = train_test_split(df, test_size=0.2, stratify=df["label"], random_state=42)
print("train:", len(train), " test:", len(test))

model = build_pipeline()
model.fit(train["text"], train["label"])

pred = model.predict(test["text"])
metrics = {
    "accuracy": round(accuracy_score(test["label"], pred), 3),
    "macro_f1": round(f1_score(test["label"], pred, average="macro"), 3),
    "train_rows": len(train),
    "test_rows": len(test),
    "classes": list(model.classes_),
}
print(json.dumps(metrics, indent=2))
print(classification_report(test["label"], pred))

save_model(model, OUT_MODEL)
OUT_METRICS.write_text(json.dumps(metrics, indent=2))
print("saved", OUT_MODEL, f"({OUT_MODEL.stat().st_size / 1e6:.1f} MB)")
