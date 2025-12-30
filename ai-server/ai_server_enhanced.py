#!/usr/bin/env python3
"""
Gopang FastAPI AI Server - Enhanced (Step C)
"""
import sys
sys.path.append('/home/ec2-user/gopang')

import time
import aiohttp
import sqlite3
from datetime import datetime
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List

# 기존 모듈
from openhash.hash_generator import create_hash_record, get_hash_statistics
from openhash.layer_propagation import LayerPropagation
from openhash.trust_calculator import TrustCalculator
from openhash.digital_signature import DigitalSignature
from openhash.hash_only_transmission import HashPacket
from openhash.pollution_detection import PollutionDetector
from openhash.healing_mechanism import HealingMechanism

# 새 모듈
from logging_config import logger
from health_check import comprehensive_health_check
from security_headers import SecurityHeadersMiddleware
from metrics import metrics

app = FastAPI(
    title="Gopang AI Server - Enhanced",
    description="Production-ready OpenHash AI System",
    version="3.3.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 보안 헤더
app.add_middleware(SecurityHeadersMiddleware)

# 메트릭 미들웨어
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    duration = time.time() - start_time
    
    metrics.record_request(
        endpoint=request.url.path,
        response_time=duration,
        status_code=response.status_code
    )
    
    return response

# 요청 로깅 미들웨어
@app.middleware("http")
async def logging_middleware(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url.path}")
    response = await call_next(request)
    logger.info(f"Response: {response.status_code}")
    return response

DB_PATH = "/home/ec2-user/gopang/database/gopang.db"
LLAMA_SERVER_0_5B = "http://127.0.0.1:8001"
LLAMA_SERVER_3B = "http://127.0.0.1:8002"

# ============== Pydantic 모델 ==============

class ChatRequest(BaseModel):
    user_id: str
    message: str
    target_user: Optional[str] = None
    ai_type: str = "personal"
    sign: bool = True

class ChatResponse(BaseModel):
    response: str
    ai_type: str
    model_used: str
    conv_id: Optional[int] = None
    hash_info: Optional[dict] = None
    trust_score: Optional[float] = None
    signature_verified: Optional[bool] = None

# ============== 기존 API (간소화) ==============

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

async def call_llama_server(url: str, prompt: str, max_tokens: int = 100) -> str:
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"{url}/completion",
                json={
                    "prompt": prompt,
                    "n_predict": max_tokens,
                    "temperature": 0.8,
                    "stream": False
                },
                timeout=aiohttp.ClientTimeout(total=30)
            ) as response:
                if response.status != 200:
                    raise Exception(f"llama-server error: {response.status}")
                data = await response.json()
                return data.get("content", "").strip()
    except Exception as e:
        logger.error(f"AI generation error: {str(e)}")
        raise Exception(f"AI generation error: {str(e)}")

@app.get("/")
async def root():
    return {
        "service": "Gopang AI Server Enhanced",
        "version": "3.3.0",
        "status": "running",
        "features": [
            "OpenHash", "Digital Signature", "Hash-only Transmission",
            "Pollution Detection", "Healing", "Metrics", "Logging"
        ]
    }

@app.get("/health/comprehensive")
async def health_comprehensive():
    """종합 헬스 체크"""
    return comprehensive_health_check()

@app.get("/metrics")
async def get_metrics():
    """메트릭 조회"""
    return metrics.get_metrics()

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """AI 대화"""
    try:
        # AI 서버 선택
        if not request.target_user:
            server_url = LLAMA_SERVER_0_5B
            model_name = "Qwen2.5-0.5B"
            max_tokens = 80
            prompt = f"너는 친근한 개인 비서야. 한국어로만 대화해.\n\n사용자: {request.message}\nAI:"
        else:
            server_url = LLAMA_SERVER_3B
            model_name = "Qwen2.5-3B"
            max_tokens = 120
            prompt = f"당신은 한국 정부 기관 AI입니다.\n\n사용자: {request.message}\nAI:"
        
        # AI 응답
        ai_response = await call_llama_server(server_url, prompt, max_tokens)
        
        # 대화 저장
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO conversations (user_id, message, response, ai_type) VALUES (?, ?, ?, ?)",
            (request.user_id, request.message, ai_response, request.ai_type)
        )
        conv_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        # OpenHash 생성
        conversation_content = f"{request.message}\n{ai_response}"
        hash_id, layer, target_ai, metadata = create_hash_record(
            user_id=request.user_id,
            content=conversation_content,
            content_type='conversation',
            sign=request.sign
        )
        
        # 신뢰도 계산
        calculator = TrustCalculator()
        trust_data = calculator.calculate_trust(hash_id)
        
        # 서명 검증
        signature_verified = None
        if request.sign and metadata.get('signature'):
            ds = DigitalSignature()
            signature_verified = ds.verify_signature(hash_id, metadata['combined_hash'])
        
        return ChatResponse(
            response=ai_response,
            ai_type=request.ai_type,
            model_used=model_name,
            conv_id=conv_id,
            hash_info={
                "hash_id": hash_id,
                "layer": layer,
                "signed": metadata.get('signature') is not None
            },
            trust_score=trust_data.get('trust_score', 0.0),
            signature_verified=signature_verified
        )
        
    except Exception as e:
        logger.error(f"Chat error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ============== 간소화된 나머지 API ==============

@app.get("/openhash/stats")
async def openhash_stats():
    return get_hash_statistics()

@app.get("/openhash/trust/{hash_id}")
async def get_trust_score(hash_id: str):
    calculator = TrustCalculator()
    return calculator.calculate_trust(hash_id)

@app.get("/pollution/stats")
async def pollution_statistics():
    detector = PollutionDetector()
    return detector.get_pollution_statistics()

@app.get("/healing/stats")
async def healing_statistics():
    healer = HealingMechanism()
    return healer.get_healing_statistics()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
