#!/usr/bin/env python3
"""
Gopang FastAPI AI Server
llama-server를 통한 Qwen 모델 연동
"""
import aiohttp
import json
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os

app = FastAPI(title="Gopang AI Server")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# llama-server URL
LLAMA_SERVER_0_5B = "http://127.0.0.1:8001"
LLAMA_SERVER_3B = "http://127.0.0.1:8002"

class ChatRequest(BaseModel):
    user_id: str
    message: str
    ai_type: str = "personal"

class ChatResponse(BaseModel):
    response: str
    ai_type: str
    model_used: str

async def call_llama_server(url: str, prompt: str, max_tokens: int = 100) -> str:
    """llama-server HTTP API 호출"""
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{url}/completion",
                json={
                    "prompt": prompt,
                    "n_predict": max_tokens,
                    "temperature": 0.7,
                    "top_p": 0.9,
                    "stream": False
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status != 200:
                    raise Exception(f"llama-server error: {response.status}")
                
                data = await response.json()
                content = data.get("content", "").strip()
                
                # Assistant: 이후 텍스트만 추출
                if "Assistant:" in content:
                    content = content.split("Assistant:")[-1].strip()
                
                return content if content else "응답을 생성할 수 없습니다."
                
    except aiohttp.ClientError as e:
        raise Exception(f"Network error: {str(e)}")
    except Exception as e:
        raise Exception(f"AI generation error: {str(e)}")

@app.get("/")
async def root():
    return {
        "service": "Gopang AI Server",
        "status": "running",
        "models": {
            "personal": "Qwen2.5-0.5B",
            "institution": "Qwen2.5-3B"
        },
        "backend": "llama-server"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """AI 채팅 엔드포인트"""
    try:
        # 모델 선택
        if request.ai_type == "personal":
            server_url = LLAMA_SERVER_0_5B
            model_name = "Qwen2.5-0.5B"
            max_tokens = 100
        else:
            server_url = LLAMA_SERVER_3B
            model_name = "Qwen2.5-3B"
            max_tokens = 150
        
        # System prompt 구성
        system_prompt = "You are a helpful AI assistant. Respond in Korean briefly and naturally."
        prompt = f"{system_prompt}\n\nUser: {request.message}\nAssistant:"
        
        # AI 응답 생성
        ai_response = await call_llama_server(server_url, prompt, max_tokens)
        
        return ChatResponse(
            response=ai_response,
            ai_type=request.ai_type,
            model_used=model_name
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
