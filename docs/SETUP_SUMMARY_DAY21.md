# GOPANG 시스템 구축 요약 - Day 21
## 프론트엔드 배포 + OpenHash 노드 연동

**작성일:** 2026-01-24  
**작성자:** Claude AI Assistant  
**서버:** gopang-dev (13.222.8.230), recovery-temp (3.231.220.126)

---

## 1. 시스템 아키텍처 개요
```
┌─────────────────────────────────────────────────────────────┐
│                    사용자 브라우저                            │
│                  http://13.222.8.230/                        │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                   gopang-dev (13.222.8.230)                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Nginx     │  │  Frontend   │  │    Backend API      │  │
│  │   :80       │──│  /gopang/   │  │    :3000 (예정)     │  │
│  │             │  │  frontend/  │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP API (5001-5004)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                recovery-temp (3.231.220.126)                 │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              OpenHash 4-Layer Nodes                    │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐  │  │
│  │  │ L4:5001 │ │ L3:5002 │ │ L2:5003 │ │ L1:5004     │  │  │
│  │  │ 한국    │◄│ 제주도  │◄│ 서귀포시│◄│ 중문동      │  │  │
│  │  │ n=13    │ │ n=10    │ │ n=7     │ │ n=4         │  │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────┘  │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 프론트엔드 파일 구조
```
/gopang/frontend/
├── index.html          (9KB)   - SPA 메인 페이지
├── favicon.ico                 - 파비콘
├── favicon.svg
├── css/
│   └── styles.css      (10KB)  - Material Design 스타일
├── js/
│   ├── config.js       (1.3KB) - OpenHash 노드 설정
│   ├── app.js          (20KB)  - 메인 애플리케이션
│   └── api/
│       └── openhash.js (2.9KB) - OpenHash API 클라이언트
└── assets/
    └── icons/
```

---

## 3. 핵심 설정 파일

### 3.1 Nginx 설정
**파일:** `/etc/nginx/sites-available/gopang-frontend`
```nginx
server {
    listen 80;
    server_name _;

    root /gopang/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /ai {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### 3.2 OpenHash 노드 설정
**파일:** `/gopang/frontend/js/config.js`
```javascript
const CONFIG = {
    OPENHASH_NODES: {
        'KR': { url: 'http://3.231.220.126:5001', layer: 4, name: '한국' },
        'KR-JEJU': { url: 'http://3.231.220.126:5002', layer: 3, name: '제주도' },
        'KR-JEJU-SEOGWIPO': { url: 'http://3.231.220.126:5003', layer: 2, name: '서귀포시' },
        'KR-JEJU-SEOGWIPO-JUNGMUN': { url: 'http://3.231.220.126:5004', layer: 1, name: '중문동' }
    },
    LPBFT_CONFIG: {
        1: { nodeCount: 4, faultTolerance: 1, quorum: 3 },
        2: { nodeCount: 7, faultTolerance: 2, quorum: 5 },
        3: { nodeCount: 10, faultTolerance: 3, quorum: 7 },
        4: { nodeCount: 13, faultTolerance: 4, quorum: 9 }
    },
    VAULT_KEYWORDS: {
        FINANCE: ['은행', '계좌', '송금', '투자', '보험', '세금'],
        MEDICAL: ['병원', '약국', '진료', '처방', '건강'],
        EDUCATION: ['학교', '대학', '학원', '등록금', '장학금'],
        ADMIN: ['주민센터', '구청', '민원', '증명서', '여권'],
        TRANSPORT: ['버스', '지하철', 'KTX', '주유', '택시'],
        GENERAL: []
    },
    POLLING_INTERVAL: 10000
};
```

---

## 4. OpenHash 노드 시작 명령어

### recovery-temp 서버에서 실행:
```bash
# SSH 접속
ssh -i "C:\Users\주피터\.ssh\gopang-dev-key.pem" ubuntu@3.231.220.126

# 노드 시작
cd /home/ubuntu/openhash-node

nohup node node-service.js --layer=4 --port=5001 --layerId=KR > /tmp/layer4.log 2>&1 &
nohup node node-service.js --layer=3 --port=5002 --layerId=KR-JEJU --parent=http://localhost:5001 > /tmp/layer3.log 2>&1 &
nohup node node-service.js --layer=2 --port=5003 --layerId=KR-JEJU-SEOGWIPO --parent=http://localhost:5002 > /tmp/layer2.log 2>&1 &
nohup node node-service.js --layer=1 --port=5004 --layerId=KR-JEJU-SEOGWIPO-JUNGMUN --parent=http://localhost:5003 > /tmp/layer1.log 2>&1 &

# 테스트 잔액 설정
curl -X POST http://localhost:5004/balance -H "Content-Type: application/json" -d '{"address":"user_A","amount":1000}'
curl -X POST http://localhost:5004/balance -H "Content-Type: application/json" -d '{"address":"user_B","amount":500}'

# 상태 확인
curl http://localhost:5001/health
curl http://localhost:5002/health
curl http://localhost:5003/health
curl http://localhost:5004/health
```

---

## 5. AWS 보안 그룹 설정

**Security Group:** `gopang-ec2-sg`

| Type | Port | Source | Description |
|------|------|--------|-------------|
| SSH | 22 | 0.0.0.0/0 | SSH 접속 |
| HTTP | 80 | 0.0.0.0/0 | 웹 서비스 |
| HTTPS | 443 | 0.0.0.0/0 | SSL (예정) |
| Custom TCP | 5001-5004 | 0.0.0.0/0 | OpenHash Nodes |

---

## 6. 구현된 기능

### 6.1 UI 구성 (Material Design, 단색 청색)
```
┌─────────────────────────────┐
│ ☰  🔗 GOPANG      ☁️4/4  ⚙️ │  ← 미니멀 헤더
├─────────────────────────────┤
│                             │
│         채팅 영역            │  ← 풀스크린 콘텐츠
│                             │
├─────────────────────────────┤
│ 💬채팅 │ ↔거래 │ 🔒Vault │ 📊 │  ← 하단 탭바
└─────────────────────────────┘
```

### 6.2 좌측 슬라이드 메뉴 (☰ 클릭)

**OpenHash 노드 상태:**
- L4 한국, L3 제주도, L2 서귀포시, L1 중문동 (실시간 상태)

**OpenHash 기능:**
- 해시 체인 조회
- LPBFT 합의 시뮬레이션
- 계층 선택 테스트
- 하향식 검증

**디지털화폐 (특허 기반):**
- 화폐 발행 (모듈 100)
- 화폐 전송 (AI 검증 모듈 200)
- 화폐 소각
- 재무제표 (모듈 300)

**통합 금융 (모듈 900):**
- 자율 대출 (0.045ms) - 엔진 910
- 자율 보험 (0.028ms) - 엔진 920
- 포트폴리오 최적화 (0.15ms) - 엔진 930
- 크로스 최적화 (연간 492만원 혜택) - 엔진 940

**Vault 6서랍:**
- 금융, 의료, 교육, 행정, 교통, 일반

---

## 7. OpenHash 노드 API

### 7.1 Health Check
```
GET http://3.231.220.126:500X/health

Response:
{
  "status": "healthy",
  "nodeId": "node-xxx",
  "layer": 4,
  "layerId": "KR",
  "chainLength": 0,
  "latestHash": "0000...",
  "lpbft": { "nodeCount": 13, "faultTolerance": 4, "quorum": 9 }
}
```

### 7.2 Transaction
```
POST http://3.231.220.126:5004/transaction
Content-Type: application/json

{ "sender": "user_A", "receiver": "user_B", "amount": 10 }
```

### 7.3 Balance
```
GET  http://3.231.220.126:5004/balance/user_A
POST http://3.231.220.126:5004/balance
     { "address": "user_A", "amount": 1000 }
```

### 7.4 Chain
```
GET http://3.231.220.126:5004/chain
```

### 7.5 Layer Selection
```
POST http://3.231.220.126:5004/select-layer
{ "documentHash": "abc123", "timestamp": 1737..., "importance": "NORMAL" }
```

### 7.6 LPBFT Trigger
```
POST http://3.231.220.126:5004/lpbft/trigger
{ "reason": "contamination" }
```

---

## 8. 디지털화폐 특허 모듈 매핑

| 모듈 번호 | 기능 | 구현 상태 |
|----------|------|----------|
| 100 | 화폐 핵심 모듈 (발행/전송/소각) | ✅ UI |
| 200 | AI 검증 모듈 (BERT/CNN/LSTM) | ✅ UI 시뮬레이션 |
| 300 | 재무제표 생성 모듈 | ✅ UI |
| 400 | FPGA 가속 모듈 | ⏳ 시뮬레이션 |
| 500 | 크로스체인 연동 모듈 | ⏳ 예정 |
| 600 | 동적 가치 산정 모듈 | ⏳ 예정 |
| 700 | 글로벌 규제 준수 모듈 | ⏳ 예정 |
| 900 | 통합 금융 서비스 모듈 | ✅ UI |
| 910 | 자율 은행 서비스 엔진 | ✅ UI |
| 920 | 자율 보험 서비스 엔진 | ✅ UI |
| 930 | 자율 증권 서비스 엔진 | ✅ UI |
| 940 | 크로스 서비스 최적화 엔진 | ✅ UI |

---

## 9. 재현 명령어 (전체)

### 9.1 gopang-dev 프론트엔드 배포
```bash
# 1. 디렉토리 생성
sudo mkdir -p /gopang/frontend/{css,js/api,assets/icons}
sudo chown -R ubuntu:ubuntu /gopang/frontend

# 2. index.html, styles.css, config.js, openhash.js, app.js 생성
# (각 파일 내용은 본 문서 상단 참조)

# 3. Nginx 설정
sudo tee /etc/nginx/sites-available/gopang-frontend << 'EOF'
server {
    listen 80;
    server_name _;
    root /gopang/frontend;
    index index.html;
    location / { try_files $uri $uri/ =404; }
    location /api { proxy_pass http://localhost:3000; }
}
EOF

sudo ln -sf /etc/nginx/sites-available/gopang-frontend /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
```

### 9.2 recovery-temp OpenHash 노드 시작
```bash
ssh -i gopang-dev-key.pem ubuntu@3.231.220.126

cd /home/ubuntu/openhash-node
nohup node node-service.js --layer=4 --port=5001 --layerId=KR > /tmp/layer4.log 2>&1 &
nohup node node-service.js --layer=3 --port=5002 --layerId=KR-JEJU --parent=http://localhost:5001 > /tmp/layer3.log 2>&1 &
nohup node node-service.js --layer=2 --port=5003 --layerId=KR-JEJU-SEOGWIPO --parent=http://localhost:5002 > /tmp/layer2.log 2>&1 &
nohup node node-service.js --layer=1 --port=5004 --layerId=KR-JEJU-SEOGWIPO-JUNGMUN --parent=http://localhost:5003 > /tmp/layer1.log 2>&1 &
```

---

## 10. 접속 정보

| 항목 | URL/정보 |
|------|----------|
| 프론트엔드 | http://13.222.8.230/ |
| gopang-dev SSH | ssh -i gopang-dev-key.pem ubuntu@13.222.8.230 |
| recovery-temp SSH | ssh -i gopang-dev-key.pem ubuntu@3.231.220.126 |
| OpenHash L4 | http://3.231.220.126:5001/health |
| OpenHash L3 | http://3.231.220.126:5002/health |
| OpenHash L2 | http://3.231.220.126:5003/health |
| OpenHash L1 | http://3.231.220.126:5004/health |

---

## 11. 다음 단계 (Phase 2)

1. **Backend API 연동** - /api 프록시 활성화
2. **AI Engine 연동** - DeepSeek R1 채팅 기능
3. **실제 거래 처리** - OpenHash 노드와 거래 연동
4. **인증 시스템** - JWT 기반 로그인
5. **SSL 인증서** - Let's Encrypt HTTPS

---

**문서 끝**
