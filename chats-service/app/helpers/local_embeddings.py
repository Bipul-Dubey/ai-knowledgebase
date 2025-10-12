import os
import faiss
import json
import numpy as np
from sentence_transformers import SentenceTransformer
from uuid import uuid4

# =========================================
# Paths
# =========================================
DATA_DIR = os.path.join(os.getcwd(), "local_data")
os.makedirs(DATA_DIR, exist_ok=True)

BASE_UPLOAD_DIR = os.path.join(DATA_DIR, "documents")
os.makedirs(BASE_UPLOAD_DIR, exist_ok=True)

FAISS_INDEX_PATH = os.path.join(DATA_DIR, "faiss_index.bin")
EMBEDDINGS_STORE_PATH = os.path.join(DATA_DIR, "embeddings_store.json")
FAISS_MAPPING_PATH = os.path.join(DATA_DIR, "faiss_id_map.json")

FAISS_DIM = 384  # all-MiniLM-L6-v2 output dimension

# =========================================
# Globals
# =========================================
model = None
faiss_index = None
embeddings_store = {}
faiss_id_to_emb_id = []

# =========================================
# Initialize Embeddings System
# =========================================
def init_embeddings_system():
    """Load model, FAISS, and data safely once."""
    global model, faiss_index, embeddings_store, faiss_id_to_emb_id

    print("🔹 Initializing embedding system...")

    # Load SentenceTransformer model
    if model is None:
        model = SentenceTransformer("all-MiniLM-L6-v2")
        print("✅ SentenceTransformer loaded.")

    # Load embeddings store
    if os.path.exists(EMBEDDINGS_STORE_PATH):
        with open(EMBEDDINGS_STORE_PATH, "r", encoding="utf-8") as f:
            embeddings_store = json.load(f)
        for k, v in embeddings_store.items():
            embeddings_store[k]["embedding"] = np.array(v["embedding"], dtype=np.float32)

    # Load FAISS ID mapping
    if os.path.exists(FAISS_MAPPING_PATH):
        with open(FAISS_MAPPING_PATH, "r", encoding="utf-8") as f:
            faiss_id_to_emb_id = json.load(f)

    # Load FAISS index
    if os.path.exists(FAISS_INDEX_PATH):
        faiss_index = faiss.read_index(FAISS_INDEX_PATH)
    else:
        faiss_index = faiss.IndexFlatL2(FAISS_DIM)

    print("✅ Embedding system initialized successfully.")


# =========================================
# Embedding Functions
# =========================================
def get_sentence_embedding(text: str) -> np.ndarray:
    global model
    if model is None:
        raise RuntimeError("❌ Model not initialized. Call init_embeddings_system() at startup.")
    return model.encode(text, normalize_embeddings=True)


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50):
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunks.append(" ".join(words[start:end]))
        start += chunk_size - overlap
    return chunks


def add_embedding_to_store(text, document_id, organization_id):
    emb_vector = get_sentence_embedding(text)
    emb_id = str(uuid4())
    embeddings_store[emb_id] = {
        "text": text,
        "document_id": str(document_id),
        "organization_id": str(organization_id),
        "embedding": emb_vector.tolist(),
    }

    faiss_index.add(np.array(emb_vector, dtype=np.float32).reshape(1, -1))
    faiss_id_to_emb_id.append(emb_id)
    return emb_id


def persist_data():
    """Persist FAISS + JSON files to disk."""
    store_copy = {}
    for k, v in embeddings_store.items():
        store_copy[k] = v.copy()
        store_copy[k]["embedding"] = (
            v["embedding"] if isinstance(v["embedding"], list) else v["embedding"].tolist()
        )

    with open(EMBEDDINGS_STORE_PATH, "w", encoding="utf-8") as f:
        json.dump(store_copy, f)

    with open(FAISS_MAPPING_PATH, "w", encoding="utf-8") as f:
        json.dump(faiss_id_to_emb_id, f)

    faiss.write_index(faiss_index, FAISS_INDEX_PATH)
    print("💾 FAISS + Embeddings persisted.")


def search_faiss(query, top_k=5, organization_id=None):
    query_vec = get_sentence_embedding(query).reshape(1, -1).astype(np.float32)
    D, I = faiss_index.search(query_vec, top_k)
    results = []

    for idx in I[0]:
        if idx == -1 or idx >= len(faiss_id_to_emb_id):
            continue
        emb_id = faiss_id_to_emb_id[idx]
        data = embeddings_store.get(emb_id)
        if not data:
            continue
        if organization_id and data["organization_id"] != str(organization_id):
            continue
        results.append(
            {
                "document_id": data["document_id"],
                "chunk_text": data["text"],
                "distance": float(D[0][idx]),
            }
        )

    return results
