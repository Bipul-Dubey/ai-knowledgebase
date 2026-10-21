FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    HF_HOME=/models

WORKDIR /app

# CPU-only torch: the default wheel carries CUDA and is several GB, and Docker
# on macOS cannot reach the GPU anyway.
RUN pip install --no-cache-dir \
      --extra-index-url https://download.pytorch.org/whl/cpu \
      torch \
      "sentence-transformers>=3.0,<6" \
      "fastapi>=0.115,<1" \
      "uvicorn>=0.30,<1"

# Bake the weights into the image so startup needs no network.
ARG RERANK_MODEL=cross-encoder/ms-marco-MiniLM-L-6-v2
ENV RERANK_MODEL=$RERANK_MODEL
RUN python -c "from sentence_transformers import CrossEncoder; CrossEncoder('$RERANK_MODEL')"

COPY app.py .

EXPOSE 8000
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
