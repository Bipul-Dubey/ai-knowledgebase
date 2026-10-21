"""Cross-encoder reranking.

Vector search finds chunks that *look like* the question. A cross-encoder reads
the question and the chunk together and scores actual relevance, which is why
retrieving wide and reranking narrow is the cheapest accuracy gain available to
a RAG pipeline.

Runs on CPU on purpose: Docker on macOS has no Metal access, so the default
model is deliberately tiny (22M params, ~40 pairs in tens of ms). A stronger
reranker such as bge-reranker-v2-m3 is better but needs a GPU to stay inside a
latency budget -- swap RERANK_MODEL once one is available.
"""

import os

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel
from sentence_transformers import CrossEncoder

MODEL_NAME = os.getenv("RERANK_MODEL", "cross-encoder/ms-marco-MiniLM-L-6-v2")

# Cross-encoders emit unbounded logits, commonly around -11..+11. Squashing to
# 0..1 is what makes a configured threshold mean anything. Turn this off only
# for a model whose head already outputs probabilities.
APPLY_SIGMOID = os.getenv("RERANK_APPLY_SIGMOID", "true").strip().lower() not in (
    "0", "false", "no",
)

app = FastAPI(title="Reranker")
_model: CrossEncoder | None = None


def model() -> CrossEncoder:
    global _model
    if _model is None:
        _model = CrossEncoder(MODEL_NAME)
    return _model


class RerankRequest(BaseModel):
    query: str
    documents: list[str]


class Scored(BaseModel):
    index: int
    score: float
    # The raw logit, returned so thresholds can be tuned from real data.
    logit: float


@app.on_event("startup")
async def warm() -> None:
    model().predict([("warm", "up")])
    print(f"[RERANK] {MODEL_NAME} ready")


@app.get("/health")
async def health() -> dict:
    return {"model": MODEL_NAME}


# Sync on purpose: FastAPI runs it in a threadpool, keeping the inference off
# the event loop.
@app.post("/rerank")
def rerank(req: RerankRequest) -> list[Scored]:
    if not req.documents:
        return []

    logits = np.asarray(
        model().predict([(req.query, d) for d in req.documents]), dtype="float64"
    )
    scores = 1.0 / (1.0 + np.exp(-logits)) if APPLY_SIGMOID else logits

    return [
        Scored(index=i, score=float(s), logit=float(l))
        for i, (s, l) in enumerate(zip(scores, logits))
    ]
