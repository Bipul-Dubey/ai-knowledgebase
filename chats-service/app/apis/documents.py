from fastapi import APIRouter, Request, UploadFile, File, status, HTTPException
import os
from pydantic import BaseModel
from app.helpers.file_manager import save_file_locally, BASE_UPLOAD_DIR
from app.database.helpers import get_db_cursor
from app.utils.response import APIResponse
from app.helpers.openai_embeddings import process_document

router = APIRouter(prefix="/documents", tags=["Documents"])


# ======================================================
# Upload Document
# ======================================================
@router.post("/upload")
async def upload_document(request: Request, file: UploadFile = File(...), title: str = None):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims["organization_id"]

    # Save file locally & validate
    file_info = save_file_locally(file, org_id, title)

    # Insert metadata into DB
    async with get_db_cursor() as cur:
        await cur.execute(
            """
            INSERT INTO documents (id, organization_id, title, file_name, file_type, status)
            VALUES (gen_random_uuid(), %s, %s, %s, %s, 'pending')
            RETURNING *
            """,
            (org_id, file_info["title"], file_info["file_name"], file_info["extension"])
        )
        document = await cur.fetchone()

    return APIResponse(False, "Document uploaded successfully", document, status.HTTP_200_OK)


# ======================================================
# Train All Documents
# ======================================================
@router.post("/train")
async def train_all_documents(request: Request):
    try:
        claims = getattr(request.state, "claims", None)
        if not claims:
            raise HTTPException(status_code=401, detail="Unauthorized")

        org_id = claims["organization_id"]

        # Fetch all documents for this organization
        async with get_db_cursor() as cur:
            await cur.execute(
                "SELECT id, file_name FROM documents WHERE organization_id=%s", (org_id,)
            )
            documents = await cur.fetchall()

        if not documents:
            raise HTTPException(status_code=404, detail="No documents found")

        # Delete previous chunks for this organization
        async with get_db_cursor() as cur:
            await cur.execute(
                "DELETE FROM document_chunks WHERE organization_id=%s", (org_id,)
            )

        total_chunks = 0
        trained_docs = 0
        trained_doc_ids = []
        error_messages = []

        async with get_db_cursor() as cur:
            for doc in documents:
                file_path = os.path.join(BASE_UPLOAD_DIR, str(org_id), doc["file_name"])
                if not os.path.exists(file_path):
                    error_messages.append(f"File missing: {file_path}")
                    continue
                try:
                    chunks_inserted = await process_document(file_path, doc["id"], org_id, cur)
                    if chunks_inserted > 0:
                        trained_docs += 1
                        total_chunks += chunks_inserted
                        trained_doc_ids.append(doc["id"])
                except Exception as e:
                    error_messages.append(f"Failed training document {doc['id']}: {str(e)}")
                    continue  # skip failing document

            # Update status only for trained documents
            if trained_doc_ids:
                await cur.execute(
                    "UPDATE documents SET status='active' WHERE id = ANY(%s)",
                    (trained_doc_ids,)
                )

        if error_messages:
            # Return detailed error response with status 400 or other appropriate code
            return APIResponse(
                True,
                "Error: ${error_messages}",
                "Errors occurred during training",
                status.HTTP_400_BAD_REQUEST,
            )

        return APIResponse(
            False,
            "✅ Training completed successfully",
            {
                "total_documents": len(documents),
                "documents_trained": trained_docs,
                "total_chunks_inserted": total_chunks
            },
            status.HTTP_200_OK,
        )

    except HTTPException as http_exc:
        raise http_exc

    except Exception as e:
        return APIResponse(True, f"Unexpected error occurred: {str(e)}", None, status.HTTP_500_INTERNAL_SERVER_ERROR)


# ======================================================
# Query Endpoint
# ======================================================
class QueryPayload(BaseModel):
    query: str
    top_k: int = 5


@router.post("/query")
async def query_documents(request: Request, payload: QueryPayload):
    claims = getattr(request.state, "claims", None)
    if not claims:
        return APIResponse(True, "Unauthorized", None, status.HTTP_401_UNAUTHORIZED)

    org_id = claims["organization_id"]

    return APIResponse(False, "Query results", org_id, status.HTTP_200_OK)
