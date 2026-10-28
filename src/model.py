"""Sentiment model for Roman Urdu: character TF-IDF + calibrated Linear SVM.

Same features as the research notebooks (char_wb 2-5 grams). Calibration adds
probabilities, so the app can show a confidence score.
"""
from pathlib import Path

import joblib
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.pipeline import make_pipeline
from sklearn.svm import LinearSVC

LABELS = ["negative", "neutral", "positive"]


def build_pipeline():
    return make_pipeline(
        TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 5), min_df=2, sublinear_tf=True),
        CalibratedClassifierCV(LinearSVC(C=1.0, class_weight="balanced"), cv=3),
    )


def load_roman_urdu(path) -> pd.DataFrame:
    """Load and clean the Roman Urdu CSV (same cleaning as the notebooks)."""
    df = pd.read_csv(path, header=None, usecols=[0, 1], names=["text", "label"],
                     on_bad_lines="skip").dropna(subset=["text"])
    df["label"] = df["label"].str.strip().str.lower().replace({"neative": "negative"})
    df["text"] = df["text"].astype(str)
    df = df[df["text"].str.strip() != ""].drop_duplicates(subset="text")
    return df


def save_model(model, path) -> None:
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, path, compress=3)


def load_model(path):
    return joblib.load(path)


def predict_texts(model, texts):
    """Return one dict per text: label, confidence and all class probabilities."""
    texts = [str(t) for t in texts]
    if not texts:
        return []
    proba = model.predict_proba(texts)
    classes = list(model.classes_)
    results = []
    for row in proba:
        best = int(row.argmax())
        results.append({
            "label": classes[best],
            "confidence": round(float(row[best]), 4),
            "probabilities": {c: round(float(p), 4) for c, p in zip(classes, row)},
        })
    return results
