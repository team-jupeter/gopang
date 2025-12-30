#!/usr/bin/env python3
"""
Gopang FastAPI AI Server with Database Integration
"""
import aiohttp
import sqlite3
import json
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
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

# 데이터베이스 경로
DB_PATH = "/home/ec2-user/gopang/database/gopang.db"

# Pydantic 모델
class ChatRequest(BaseModel):
    user_id: str
    message: str
    ai_type: str = "personal"

class ChatResponse(BaseModel):
    response: str
    ai_type: str
    model_used: str
    conv_id: Optional[int] = None

class User(BaseModel):
    user_id: str
    user_type: str
    name: str

class ConversationHistory(BaseModel):
    conv_id: int
    user_id: str
    message: str
    response: str
    ai_type: str
    created_at: str

# 데이터베이스 함수
def get_db():
    """데이터베이스 연결"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def save_conversation(user_id: str, message: str, response: str, ai_type: str) -> int:
    """대화 기록 저장"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO conversations (user_id, message, response, ai_type) VALUES (?, ?, ?, ?)",
        (user_id, message, response, ai_type)
    )
    conv_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return conv_id

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
                
                if "Assistant:" in content:
                    content = content.split("Assistant:")[-1].strip()
                
                return content if content else "응답을 생성할 수 없습니다."
                
    except Exception as e:
        raise Exception(f"AI generation error: {str(e)}")

# API 엔드포인트
@app.get("/")
async def root():
    return {
        "service": "Gopang AI Server",
        "status": "running",
        "models": {
            "personal": "Qwen2.5-0.5B",
            "institution": "Qwen2.5-3B"
        },
        "backend": "llama-server",
        "database": "SQLite"
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """AI 채팅 엔드포인트 (대화 기록 저장)"""
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
        
        # System prompt
        system_prompt = "You are a helpful AI assistant. Respond in Korean briefly and naturally."
        prompt = f"{system_prompt}\n\nUser: {request.message}\nAssistant:"
        
        # AI 응답 생성
        ai_response = await call_llama_server(server_url, prompt, max_tokens)
        
        # 데이터베이스에 저장
        conv_id = save_conversation(
            user_id=request.user_id,
            message=request.message,
            response=ai_response,
            ai_type=request.ai_type
        )
        
        return ChatResponse(
            response=ai_response,
            ai_type=request.ai_type,
            model_used=model_name,
            conv_id=conv_id
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history/{user_id}", response_model=List[ConversationHistory])
async def get_history(user_id: str, limit: int = 10):
    """사용자 대화 기록 조회"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT conv_id, user_id, message, response, ai_type, created_at
            FROM conversations
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?
            """,
            (user_id, limit)
        )
        rows = cursor.fetchall()
        conn.close()
        
        return [
            ConversationHistory(
                conv_id=row["conv_id"],
                user_id=row["user_id"],
                message=row["message"],
                response=row["response"],
                ai_type=row["ai_type"],
                created_at=row["created_at"]
            )
            for row in rows
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users", response_model=User)
async def create_user(user: User):
    """사용자 생성"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (user_id, user_type, name) VALUES (?, ?, ?)",
            (user.user_id, user.user_type, user.name)
        )
        conn.commit()
        conn.close()
        return user
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
