#!/usr/bin/env python3
"""
Gopang FastAPI AI Server with OpenHash + Trust + Digital Signature
"""
import aiohttp
import sqlite3
import sys
sys.path.append('/home/ec2-user/gopang')

from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
from openhash.hash_generator import create_hash_record, get_hash_statistics
from openhash.layer_propagation import LayerPropagation
from openhash.trust_calculator import TrustCalculator
from openhash.digital_signature import DigitalSignature

app = FastAPI(title="Gopang AI Server - Phase 3")

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
    target_user: Optional[str] = None
    ai_type: str = "personal"
    sign: bool = True  # 디지털 서명 활성화

class ChatResponse(BaseModel):
    response: str
    ai_type: str
    model_used: str
    conv_id: Optional[int] = None
    hash_info: Optional[dict] = None
    trust_score: Optional[float] = None
    signature_verified: Optional[bool] = None

class User(BaseModel):
    user_id: str
    user_type: str
    name: str
    region_code: Optional[str] = '5011025000'

class UserInfo(BaseModel):
    user_id: str
    name: str
    user_type: str
    is_online: bool

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
        "version": "Phase 3 - Digital Signature",
        "features": {
            "openhash": "enabled",
            "layer_propagation": "enabled",
            "trust_calculation": "enabled",
            "digital_signature": "enabled (ECDSA-P256)"
        }
    }

@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/users/list", response_model=List[UserInfo])
async def list_users():
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT user_id, name, user_type, 1 as is_online
            FROM users
            WHERE user_type = 'personal'
        """)
        humans = cursor.fetchall()
        
        cursor.execute("""
            SELECT ai_id as user_id, ai_name as name, ai_type as user_type, 1 as is_online
            FROM ai_users
            WHERE ai_type = 'institution'
        """)
        ai_users = cursor.fetchall()
        
        conn.close()
        
        result = []
        for row in humans:
            result.append(UserInfo(
                user_id=row["user_id"],
                name=row["name"],
                user_type="사람",
                is_online=True
            ))
        
        for row in ai_users:
            result.append(UserInfo(
                user_id=row["user_id"],
                name=row["name"],
                user_type="기관",
                is_online=True
            ))
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    try:
        if not request.target_user:
            server_url = LLAMA_SERVER_0_5B
            model_name = "Qwen2.5-0.5B"
            max_tokens = 80
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
            
            conn = get_db()
            cursor = conn.cursor()
            cursor.execute("SELECT system_prompt FROM ai_users WHERE ai_id = ?", (request.target_user,))
            row = cursor.fetchone()
            conn.close()
            
            system_prompt = row["system_prompt"] if row else "당신은 한국 정부 기관 AI입니다. 한국어로만 답변하세요."
            
            prompt = f"""{system_prompt}

사용자: {request.message}
AI:"""
        
        ai_response = await call_llama_server(server_url, prompt, max_tokens)
        
        conv_id = save_conversation(
            user_id=request.user_id,
            message=request.message,
            response=ai_response,
            ai_type=request.ai_type
        )
        
        # OpenHash 레코드 생성 + 디지털 서명
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
        
        hash_info = {
            "hash_id": hash_id,
            "layer": layer,
            "target_ai": target_ai,
            "algorithm": metadata['algorithm'],
            "previous_hash": metadata['previous_hash'],
            "signed": metadata.get('signature') is not None,
            "signature_id": metadata['signature']['signature_id'] if metadata.get('signature') else None
        }
        
        return ChatResponse(
            response=ai_response,
            ai_type=request.ai_type,
            model_used=model_name,
            conv_id=conv_id,
            hash_info=hash_info,
            trust_score=trust_data.get('trust_score', 0.0),
            signature_verified=signature_verified
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

@app.get("/openhash/stats")
async def openhash_stats():
    """OpenHash 통계 조회"""
    try:
        stats = get_hash_statistics()
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/openhash/propagate")
async def propagate_layers():
    """계층 간 해시 전파 실행"""
    try:
        propagation = LayerPropagation()
        results = propagation.propagate_all()
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/openhash/trust/{hash_id}")
async def get_trust_score(hash_id: str):
    """특정 해시의 신뢰도 조회"""
    try:
        calculator = TrustCalculator()
        trust_data = calculator.calculate_trust(hash_id)
        return trust_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/openhash/trust/all")
async def get_all_trust_scores():
    """모든 해시의 신뢰도 조회"""
    try:
        calculator = TrustCalculator()
        trust_scores = calculator.get_all_trust_scores()
        return {
            "total": len(trust_scores),
            "scores": trust_scores,
            "average": sum(ts['trust_score'] for ts in trust_scores) / len(trust_scores) if trust_scores else 0
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/signature/{hash_id}")
async def get_signature(hash_id: str):
    """특정 해시의 서명 정보 조회"""
    try:
        ds = DigitalSignature()
        sig_info = ds.get_signature_info(hash_id)
        
        if not sig_info:
            raise HTTPException(status_code=404, detail="Signature not found")
        
        return sig_info
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/signature/verify/{hash_id}")
async def verify_signature(hash_id: str):
    """서명 검증"""
    try:
        # 해시 조회
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT content_hash FROM openhash_records
            WHERE hash_id = ?
        """, (hash_id,))
        
        record = cursor.fetchone()
        conn.close()
        
        if not record:
            raise HTTPException(status_code=404, detail="Hash not found")
        
        # 서명 검증
        ds = DigitalSignature()
        is_valid = ds.verify_signature(hash_id, record['content_hash'])
        
        return {
            "hash_id": hash_id,
            "verified": is_valid,
            "algorithm": "ECDSA-P256-SHA256"
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/signature/verify-chain")
async def verify_chain(hash_ids: List[str]):
    """체인 무결성 검증"""
    try:
        ds = DigitalSignature()
        results = ds.verify_chain_integrity(hash_ids)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/users", response_model=User)
async def create_user(user: User):
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO users (user_id, user_type, name, region_code) VALUES (?, ?, ?, ?)",
            (user.user_id, user.user_type, user.name, user.region_code)
        )
        conn.commit()
        
        # 키 쌍 생성
        ds = DigitalSignature()
        ds.generate_key_pair(user.user_id)
        
        conn.close()
        
        return user
    except:
        return user

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

# ============== 해시 전용 전송 API ==============

from openhash.hash_only_transmission import HashPacket

class HashOnlyRequest(BaseModel):
    user_id: str
    message: str
    target_user: Optional[str] = None
    hash_only: bool = True  # 해시 전용 모드

class HashOnlyResponse(BaseModel):
    packet_size: int
    original_size: int
    saving_percentage: float
    packet_hex: str
    hash_info: dict

@app.post("/chat/hash-only", response_model=HashOnlyResponse)
async def chat_hash_only(request: HashOnlyRequest):
    """
    해시 전용 전송 모드
    
    원본 문서를 전송하지 않고 147바이트 패킷만 전송
    """
    try:
        # 1. 원본 메시지 크기
        original_size = len(request.message.encode('utf-8'))
        
        # 2. 해시 생성 (디지털 서명 포함)
        conversation_content = request.message
        hash_id, layer, target_ai, metadata = create_hash_record(
            user_id=request.user_id,
            content=conversation_content,
            content_type='conversation',
            sign=True
        )
        
        # 3. 해시 전용 패킷 생성
        packet = HashPacket.create_packet(
            content_hash=metadata['combined_hash'],
            timestamp=metadata['timestamp'],
            region_code=metadata['region_code'],
            previous_hash=metadata['previous_hash'],
            signature_r=metadata['signature']['r'] if metadata.get('signature') else None,
            signature_s=metadata['signature']['s'] if metadata.get('signature') else None,
            has_signature=metadata.get('signature') is not None
        )
        
        # 4. 대역폭 절약 계산
        savings = HashPacket.calculate_bandwidth_saving(original_size)
        
        return HashOnlyResponse(
            packet_size=len(packet),
            original_size=original_size,
            saving_percentage=savings['saving_percentage'],
            packet_hex=packet.hex(),
            hash_info={
                "hash_id": hash_id,
                "layer": layer,
                "target_ai": target_ai,
                "algorithm": metadata['algorithm'],
                "signed": metadata.get('signature') is not None
            }
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/packet/parse")
async def parse_packet(packet_hex: str):
    """
    해시 전용 패킷 파싱
    
    Args:
        packet_hex: 16진수 패킷 문자열
    """
    try:
        packet_bytes = bytes.fromhex(packet_hex)
        parsed = HashPacket.parse_packet(packet_bytes)
        return parsed
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/bandwidth/stats")
async def bandwidth_statistics():
    """
    대역폭 절약 통계
    """
    try:
        conn = get_db()
        cursor = conn.cursor()
        
        # 전체 대화 수
        cursor.execute("SELECT COUNT(*) FROM conversations")
        total_conversations = cursor.fetchone()[0]
        
        # 평균 메시지 크기 (가정: 200바이트)
        avg_message_size = 200
        
        # 전통적 전송 방식
        traditional_total = total_conversations * avg_message_size
        
        # 해시 전용 전송 방식
        hash_only_total = total_conversations * HashPacket.TOTAL_SIZE
        
        # 절약량
        saved_bytes = traditional_total - hash_only_total
        saving_percentage = (saved_bytes / traditional_total * 100) if traditional_total > 0 else 0
        
        conn.close()
        
        return {
            "total_conversations": total_conversations,
            "traditional_method": {
                "total_bytes": traditional_total,
                "avg_per_message": avg_message_size
            },
            "hash_only_method": {
                "total_bytes": hash_only_total,
                "bytes_per_packet": HashPacket.TOTAL_SIZE
            },
            "savings": {
                "bytes": saved_bytes,
                "percentage": round(saving_percentage, 2),
                "human_readable": f"{saved_bytes / 1024:.2f} KB" if saved_bytes < 1024*1024 else f"{saved_bytes / (1024*1024):.2f} MB"
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
