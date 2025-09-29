from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class AIRequest(BaseModel):
    text: str

class AIResponse(BaseModel):
    result: str
    status: str

@app.post("/process")
async def process_ai(request: AIRequest):
    # Your AI processing logic here
    processed_text = f"AI processed: {request.text}"
    
    return AIResponse(
        result=processed_text,
        status="success"
    )

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
