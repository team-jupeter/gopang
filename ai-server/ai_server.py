#!/usr/bin/env python3
import aiohttp
import sqlite3
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

app = FastAPI(title="Gopang AI Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

LLAMA_SERVER_0_5B = "http://127.0.0.1:8001"
LLAMA_SERVER_3B = "http://127.0.0.1:8002"
DB_PATH = "/home/ec2-user/gopang/database/gopang.db"

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

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def save_conversation(user_id: str, message: str, response: str, ai_type: str) -> int:
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
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{url}/completion",
                json={
                    "prompt": prompt,
                    "n_predict": max_tokens,
                    "temperature": 0.8,
                    "top_p": 0.9,
                    "top_k": 40,
                    "repeat_penalty": 1.1,
                    "stream": False
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status != 200:
                    raise Exception(f"llama-server error: {response.status}")
                
                data = await response.json()
                content = data.get("content", "").strip()
                
                # 불필요한 프롬프트 반복 제거
                if "사용자:" in content:
                    content = content.split("사용자:")[0].strip()
                if "AI:" in content:
                    content = content.split("AI:")[-1].strip()
                
                return content if content else "죄송해요, 답변을 생성하지 못했어요."
                
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
        }
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        if request.ai_type == "personal":
            server_url = LLAMA_SERVER_0_5B
            model_name = "Qwen2.5-0.5B"
            max_tokens = 80
            # 간결하고 자연스러운 프롬프트
            prompt = f"""너는 친근한 개인 비서야. 한국어로만 대화해.

규칙:
- 짧고 간단하게 답변
- 존댓말 사용
- 자연스럽게 대화
- 한 문장으로 답변

사용자: {request.message}
AI:"""
        else:
            server_url = LLAMA_SERVER_3B
            model_name = "Qwen2.5-3B"
            max_tokens = 120
            prompt = f"""당신은 정부 기관 AI입니다. 한국어로만 답변하세요.

규칙:
- 정확하고 공식적인 어조
- 2-3 문장으로 간결하게
- 존댓말 사용

사용자: {request.message}
AI:"""
        
        ai_response = await call_llama_server(server_url, prompt, max_tokens)
        
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
    except:
        return user

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
