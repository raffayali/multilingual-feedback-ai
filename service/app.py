"""Model service (FastAPI). Run from the project root:

    uvicorn service.app:app --reload --port 8000

Endpoints:  GET /health   POST /predict  {"texts": ["...", "..."]}
"""
import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import List

sys.path.append(str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from src.model import load_model, predict_texts

MODEL_PATH = os.environ.get("MODEL_PATH", "models/sentiment_tfidf.joblib")
MAX_TEXTS = 500
MAX_CHARS = 2000

state = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not Path(MODEL_PATH).exists():
        raise RuntimeError(f"Model file not found: {MODEL_PATH}. Run scripts/train_final_model.py first.")
    state["model"] = load_model(MODEL_PATH)
    yield
    state.clear()


app = FastAPI(title="Roman Urdu Sentiment Service", version="1.0", lifespan=lifespan)


class PredictRequest(BaseModel):
    texts: List[str] = Field(..., description="Messages to classify")


@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": "model" in state}


@app.post("/predict")
def predict(req: PredictRequest):
    if not req.texts:
        raise HTTPException(status_code=400, detail="texts must not be empty")
    if len(req.texts) > MAX_TEXTS:
        raise HTTPException(status_code=400, detail=f"at most {MAX_TEXTS} texts per request")
    cleaned = [t.strip()[:MAX_CHARS] for t in req.texts]
    if any(not t for t in cleaned):
        raise HTTPException(status_code=400, detail="texts must not contain empty strings")
    return {"results": predict_texts(state["model"], cleaned)}
