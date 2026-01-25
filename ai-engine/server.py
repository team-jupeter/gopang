"""
Gopang AI Engine - FastAPI Server v3.2
"""
import httpx
import time
import os
import subprocess
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Gopang AI Engine", version="0.3.2")

GOPANG_SYSTEM_PROMPT = """GOPANG 중개 AI입니다. 전문 기관 AI에게 업무를 지시합니다.
호출 가능: 경찰청_AI, 법원_AI, 국세청_AI, 주민센터_AI, 병원_AI, 은행_AI"""

MODEL_PATH = "/gopang/ai-engine/models/gopang-exaone-finetuned-Q4_K_M.gguf"
LLAMA_PORT = 8080

class ChatRequest(BaseModel):
    message: str
    system_prompt: Optional[str] = None
    max_tokens: Optional[int] = 150

class ChatResponse(BaseModel):
    response: str
    processing_time: float

def get_memory_info() -> dict:
    try:
        result = subprocess.run(['free', '-m'], capture_output=True, text=True)
        lines = result.stdout.strip().split('\n')
        mem_parts = lines[1].split()
        return {"ram_used_mb": int(mem_parts[2]), "ram_available_mb": int(mem_parts[6])}
    except:
        return {}

@app.get("/health")
async def health_check():
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"http://localhost:{LLAMA_PORT}/health", timeout=5)
            llama_ok = r.status_code == 200
    except:
        llama_ok = False
    return {
        "status": "ok" if llama_ok else "llama_not_ready",
        "model_loaded": os.path.exists(MODEL_PATH),
        "model_name": "gopang-exaone-finetuned-Q4_K_M",
        "llama_server_status": "running" if llama_ok else "not_running",
        "memory_info": get_memory_info()
    }

@app.post("/inference", response_model=ChatResponse)
async def inference(request: ChatRequest):
    start_time = time.time()
    
    system = request.system_prompt if request.system_prompt else GOPANG_SYSTEM_PROMPT
    prompt = f"[|system|]{system}[|endofturn|]\n[|user|]{request.message}[|endofturn|]\n[|assistant|]"
    
    payload = {
        "prompt": prompt,
        "n_predict": request.max_tokens,
        "temperature": 0.7,
        "stop": ["[|endofturn|]", "[|user|]"]
    }
    
    try:
        # 타임아웃을 5분으로 설정
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0)) as client:
            response = await client.post(
                f"http://localhost:{LLAMA_PORT}/completion",
                json=payload
            )
            result = response.json()
        
        processing_time = time.time() - start_time
        content = result.get("content", "").strip()
        
        return ChatResponse(response=content, processing_time=processing_time)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="추론 시간 초과")
    except Exception as e:
        logger.error(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {"message": "Gopang AI Engine v0.3.2"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
