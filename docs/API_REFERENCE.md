# 📡 Gopang API Reference

**Version**: 3.2.0  
**Base URL**: `http://your-server/api` (프로덕션)  
**Base URL**: `http://localhost:8000` (개발)

---

## 🎯 API 개요

Gopang은 RESTful API를 제공하며, 모든 엔드포인트는 JSON 형식으로 통신합니다.

**Swagger UI**: http://localhost:8000/docs  
**ReDoc**: http://localhost:8000/redoc

---

## 🔐 인증

현재 버전(프로토타입): 인증 없음  
향후 버전: JWT Bearer Token
```http
Authorization: Bearer <token>
```

---

## 📋 엔드포인트 목록

### 1. 서버 정보

#### GET `/`

**설명**: 서버 상태 및 기능 조회

**응답 예시**:
```json
{
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
```

#### GET `/health`

**설명**: 헬스 체크

**응답**:
```json
{
  "status": "healthy"
}
```

---

### 2. 대화 API

#### POST `/chat`

**설명**: AI와 대화 + OpenHash 생성 + 디지털 서명

**요청 본문**:
```json
{
  "user_id": "string (필수)",
  "message": "string (필수)",
  "target_user": "string (선택, AI ID)",
  "ai_type": "string (기본: personal)",
  "sign": "boolean (기본: true)"
}
```

**요청 예시**:
```json
{
  "user_id": "jupiter",
  "message": "제주도 관광 명소 추천해줘",
  "target_user": "ai_09",
  "sign": true
}
```

**응답**:
```json
{
  "response": "제주도의 대표 관광지로는...",
  "ai_type": "personal",
  "model_used": "Qwen2.5-3B",
  "conv_id": 15,
  "hash_info": {
    "hash_id": "hash_20251230124202_47ac8090",
    "layer": 3,
    "target_ai": "ai_09",
    "algorithm": "SHA256(H_doc || T || R)",
    "previous_hash": "hash_20251230123351_0b8291d8",
    "signed": true,
    "signature_id": 7
  },
  "trust_score": 3.1516,
  "signature_verified": true
}
```

**상태 코드**:
- `200`: 성공
- `500`: 서버 오류

---

#### POST `/chat/hash-only`

**설명**: 해시 전용 전송 모드 (147바이트 패킷)

**요청 본문**:
```json
{
  "user_id": "string (필수)",
  "message": "string (필수)",
  "target_user": "string (선택)",
  "hash_only": "boolean (기본: true)"
}
```

**응답**:
```json
{
  "packet_size": 147,
  "original_size": 5242880,
  "saving_percentage": 100.0,
  "packet_hex": "777f44e937226b366dbbd3599f...",
  "hash_info": {
    "hash_id": "hash_20251230124202_47ac8090",
    "layer": 3,
    "target_ai": "ai_09",
    "algorithm": "SHA256(H_doc || T || R)",
    "signed": true
  }
}
```

**대역폭 절약**:
- 1KB: 85.64%
- 1MB: 99.99%
- 100MB: 99.9999%

---

### 3. 대화 기록 API

#### GET `/history/{user_id}`

**설명**: 사용자의 대화 기록 조회

**파라미터**:
- `user_id` (path): 사용자 ID
- `limit` (query): 최대 개수 (기본: 10)

**예시**: `/history/jupiter?limit=20`

**응답**:
```json
[
  {
    "conv_id": 15,
    "user_id": "jupiter",
    "message": "안녕하세요",
    "response": "안녕하세요! 무엇을 도와드릴까요?",
    "ai_type": "personal",
    "created_at": "2025-12-30T12:42:02"
  }
]
```

---

### 4. 사용자 관리 API

#### GET `/users/list`

**설명**: 모든 사용자 및 AI 목록

**응답**:
```json
[
  {
    "user_id": "jupiter",
    "name": "주피터",
    "user_type": "사람",
    "is_online": true
  },
  {
    "user_id": "ai_09",
    "name": "제주특별자치도청",
    "user_type": "기관",
    "is_online": true
  }
]
```

#### POST `/users`

**설명**: 새 사용자 생성 (자동 키 쌍 생성)

**요청**:
```json
{
  "user_id": "newuser",
  "user_type": "personal",
  "name": "홍길동",
  "region_code": "5011025000"
}
```

**응답**: 생성된 사용자 정보

---

### 5. OpenHash API

#### GET `/openhash/stats`

**설명**: OpenHash 통계

**응답**:
```json
{
  "total": 15,
  "by_layer": {
    "1": 8,
    "2": 3,
    "3": 2,
    "4": 2
  },
  "ai_distribution": [
    {
      "ai_id": "ai_06",
      "ai_name": "한림읍행정복지센터",
      "count": 5
    }
  ]
}
```

#### POST `/openhash/propagate`

**설명**: 계층 간 해시 전파 실행

**응답**:
```json
{
  "timestamp": "2025-12-30T12:42:48.937392",
  "propagations": [
    {
      "layer_from": 1,
      "layer_to": 2,
      "propagations": [
        {
          "city_code": "5011",
          "target_ai": "ai_07",
          "propagation_hash_id": "prop_L2_20251230121248_4194b891",
          "merkle_root": "4194b8910bc5996e...",
          "child_count": 3
        }
      ],
      "total_cities": 1
    }
  ]
}
```

---

### 6. 신뢰도 API

#### GET `/openhash/trust/{hash_id}`

**설명**: 특정 해시의 신뢰도 조회

**파라미터**:
- `hash_id` (path): 해시 ID

**응답**:
```json
{
  "hash_id": "hash_20251230124202_47ac8090",
  "trust_score": 3.1516,
  "components": {
    "network_score": 1.5758,
    "layer_weight": 2.0,
    "signer_trust": 1.0,
    "time_factor": 1.0,
    "cross_score": 1.0
  },
  "layer": 3,
  "created_at": "2025-12-30 12:42:02"
}
```

#### GET `/openhash/trust/all`

**설명**: 모든 해시의 신뢰도 조회

**응답**:
```json
{
  "total": 15,
  "scores": [
    {
      "hash_id": "hash_20251230124202_47ac8090",
      "trust_score": 3.1516,
      "components": {...},
      "layer": 3
    }
  ],
  "average": 2.1847
}
```

---

### 7. 디지털 서명 API

#### GET `/signature/{hash_id}`

**설명**: 서명 정보 조회

**응답**:
```json
{
  "signature_id": 7,
  "hash_id": "hash_20251230124202_47ac8090",
  "signer_id": "jupiter",
  "r": "0xd1949bfaabc208a067633db05ead...",
  "s": "0xdb26e02194a508710e6b8631268b...",
  "timestamp": "2025-12-30T12:42:02",
  "verified": true,
  "previous_hash": "hash_20251230123351_0b8291d8"
}
```

#### POST `/signature/verify/{hash_id}`

**설명**: 서명 검증

**응답**:
```json
{
  "hash_id": "hash_20251230124202_47ac8090",
  "verified": true,
  "algorithm": "ECDSA-P256-SHA256"
}
```

#### POST `/signature/verify-chain`

**설명**: 체인 무결성 검증

**요청**:
```json
["hash_001", "hash_002", "hash_003"]
```

**응답**:
```json
{
  "valid": true,
  "total_checked": 3,
  "verified": 3,
  "failed": 0,
  "errors": []
}
```

---

### 8. 패킷 파싱 API

#### POST `/packet/parse`

**설명**: 147바이트 패킷 파싱

**요청**:
```json
{
  "packet_hex": "777f44e937226b366dbbd3599f3d2930..."
}
```

**응답**:
```json
{
  "content_hash": "777f44e937226b366dbbd3599f3d2930...",
  "timestamp": 1735560960,
  "datetime": "2025-12-30T12:42:40",
  "region_code": "5011025000",
  "previous_hash": "hash_20251230123351_0b8291d8",
  "signature_r": "0x384e4cb18893b448...",
  "signature_s": "0xa81fa20a0662d624...",
  "has_signature": true,
  "has_previous_hash": true
}
```

---

### 9. 대역폭 통계 API

#### GET `/bandwidth/stats`

**설명**: 대역폭 절약 통계

**응답**:
```json
{
  "total_conversations": 15,
  "traditional_method": {
    "total_bytes": 3000,
    "avg_per_message": 200
  },
  "hash_only_method": {
    "total_bytes": 2205,
    "bytes_per_packet": 147
  },
  "savings": {
    "bytes": 795,
    "percentage": 26.5,
    "human_readable": "0.78 KB"
  }
}
```

---

## 🔄 워크플로우 예시

### 시나리오 1: 기본 대화
```bash
# 1. 대화 전송
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "jupiter",
    "message": "안녕하세요",
    "sign": true
  }'

# 응답에서 hash_id 추출
# hash_id = "hash_20251230124202_47ac8090"

# 2. 신뢰도 확인
curl http://localhost:8000/openhash/trust/hash_20251230124202_47ac8090

# 3. 서명 검증
curl -X POST http://localhost:8000/signature/verify/hash_20251230124202_47ac8090
```

### 시나리오 2: 해시 전용 전송
```bash
# 1. 대용량 문서를 해시로만 전송
curl -X POST http://localhost:8000/chat/hash-only \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "jupiter",
    "message": "5MB 문서 내용...",
    "hash_only": true
  }'

# 2. 패킷 파싱
curl -X POST http://localhost:8000/packet/parse \
  -H "Content-Type: application/json" \
  -d '{
    "packet_hex": "777f44e937226b366..."
  }'
```

### 시나리오 3: 계층 전파
```bash
# 1. 여러 대화 생성
for i in {1..10}; do
  curl -X POST http://localhost:8000/chat \
    -H "Content-Type: application/json" \
    -d "{\"user_id\": \"jupiter\", \"message\": \"메시지 $i\"}"
done

# 2. 전파 실행
curl -X POST http://localhost:8000/openhash/propagate

# 3. 통계 확인
curl http://localhost:8000/openhash/stats
```

---

## 🚨 에러 코드

| 코드 | 의미 | 설명 |
|------|------|------|
| 200 | OK | 요청 성공 |
| 400 | Bad Request | 잘못된 요청 |
| 404 | Not Found | 리소스 없음 |
| 500 | Internal Server Error | 서버 오류 |

**에러 응답 형식**:
```json
{
  "detail": "Error message"
}
```

---

## 📊 Rate Limiting

현재 버전: 제한 없음  
향후 버전: 1000 req/hour per user

---

## 🔧 SDK 예제

### Python SDK
```python
import requests

class GopangClient:
    def __init__(self, base_url="http://localhost:8000"):
        self.base_url = base_url
    
    def chat(self, user_id, message, target_user=None, sign=True):
        """대화 전송"""
        response = requests.post(f"{self.base_url}/chat", json={
            "user_id": user_id,
            "message": message,
            "target_user": target_user,
            "sign": sign
        })
        return response.json()
    
    def get_trust(self, hash_id):
        """신뢰도 조회"""
        response = requests.get(f"{self.base_url}/openhash/trust/{hash_id}")
        return response.json()
    
    def verify_signature(self, hash_id):
        """서명 검증"""
        response = requests.post(f"{self.base_url}/signature/verify/{hash_id}")
        return response.json()

# 사용 예시
client = GopangClient()

# 대화
result = client.chat("jupiter", "안녕하세요")
hash_id = result['hash_info']['hash_id']

# 신뢰도
trust = client.get_trust(hash_id)
print(f"신뢰도: {trust['trust_score']}")

# 검증
verified = client.verify_signature(hash_id)
print(f"검증: {verified['verified']}")
```

### JavaScript SDK
```javascript
class GopangClient {
  constructor(baseUrl = 'http://localhost:8000') {
    this.baseUrl = baseUrl;
  }

  async chat(userId, message, targetUser = null, sign = true) {
    const response = await fetch(`${this.baseUrl}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        message: message,
        target_user: targetUser,
        sign: sign
      })
    });
    return await response.json();
  }

  async getTrust(hashId) {
    const response = await fetch(`${this.baseUrl}/openhash/trust/${hashId}`);
    return await response.json();
  }

  async verifySignature(hashId) {
    const response = await fetch(`${this.baseUrl}/signature/verify/${hashId}`, {
      method: 'POST'
    });
    return await response.json();
  }
}

// 사용 예시
const client = new GopangClient();

// 대화
const result = await client.chat('jupiter', '안녕하세요');
const hashId = result.hash_info.hash_id;

// 신뢰도
const trust = await client.getTrust(hashId);
console.log(`신뢰도: ${trust.trust_score}`);

// 검증
const verified = await client.verifySignature(hashId);
console.log(`검증: ${verified.verified}`);
```

---

## 📝 변경 이력

### v3.2.0 (2025-12-30)
- ✅ 해시 전용 전송 API 추가
- ✅ 대역폭 통계 API 추가
- ✅ 패킷 파싱 API 추가

### v3.1.0 (2025-12-30)
- ✅ 디지털 서명 API 추가
- ✅ 서명 검증 API 추가
- ✅ 체인 무결성 검증 추가

### v2.0.0 (2025-12-30)
- ✅ 신뢰도 계산 API 추가
- ✅ 계층 전파 API 추가
- ✅ OpenHash 통합

### v1.0.0 (2025-12-30)
- ✅ 기본 대화 API
- ✅ 사용자 관리 API
- ✅ 대화 기록 API

---

**문서 버전**: 3.2.0  
**최종 업데이트**: 2025-12-30  
**문의**: https://github.com/team-jupeter/gopang/issues
