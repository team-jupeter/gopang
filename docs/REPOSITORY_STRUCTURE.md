# GOPANG & OpenHash 저장소 구조

**최종 업데이트**: 2026-01-26

---

## 1. 저장소 목록

| 저장소 | URL | 용도 |
|--------|-----|------|
| **gopang** | https://github.com/team-jupeter/gopang | GOPANG 웹앱 (gopang.net) |
| **openhash-website** | https://github.com/team-jupeter/openhash-website | OpenHash 웹사이트 (openhash.kr) |
| **openhash-node** | https://github.com/team-jupeter/openhash-node | OpenHash 4계층 노드 서버 |

---

## 2. gopang (웹앱)
```
gopang/
├── README.md
├── .gitignore
├── package.json
│
├── frontend/              # 웹앱 프론트엔드
│   ├── index.html         # 메인 (AI 채팅)
│   ├── shop.html          # 쇼핑
│   ├── financial-statement.html  # 재무제표
│   ├── css/
│   └── js/
│
├── backend/               # Express API 서버
│   ├── server.js
│   ├── routes/
│   └── models/
│
├── ai-engine/             # FastAPI AI 엔진
│   ├── main.py
│   └── requirements.txt
│
├── docs/                  # 문서
├── scripts/               # 유틸리티 스크립트
├── terraform/             # 인프라 코드
└── test-openhash.js       # 테스트 스크립트
```

### 배포 위치
- **서버**: gopang-dev (13.222.8.230)
- **경로**: `/gopang/`
- **도메인**: https://gopang.net

---

## 3. openhash-website (웹사이트)
```
openhash-website/
├── index.html             # 홈페이지
├── style.css              # 메인 스타일
│
├── css/                   # 공통 CSS
│   ├── base.css
│   ├── components.css
│   ├── sections.css
│   └── variables.css
│
├── js/                    # JavaScript
│   ├── main.js
│   ├── hierarchy.js
│   ├── simulation.js
│   └── sim-*.js           # 시뮬레이션별 JS
│
├── technology/            # 기술 문서 (8개)
│   ├── index.html
│   ├── tech-common.css
│   ├── hierarchy.html
│   ├── verification.html
│   ├── consensus.html
│   ├── layer-select.html
│   ├── ssi.html
│   ├── currency.html
│   ├── vault.html
│   └── hashchain.html
│
├── simulation/            # 시뮬레이션 (6개)
│   ├── index.html
│   ├── sim-common.css
│   ├── transaction.html
│   ├── layer-select.html
│   ├── verification.html
│   ├── lpbft.html
│   ├── ssi.html
│   └── hashchain.html
│
└── tests/                 # 테스트 센터 (11개 카테고리)
    ├── index.html
    ├── test-detail.css
    └── category-a.html ~ category-k.html
```

### 배포 위치
- **서버**: gopang-dev (13.222.8.230)
- **경로**: `/openhash/frontend/`
- **도메인**: https://openhash.kr

---

## 4. openhash-node (노드 서버)
```
openhash-node/
├── node-service.js        # 메인 노드 서버
├── node-service.js.backup
├── package.json
├── package-lock.json
├── .gitignore
│
├── add-endpoints.js       # 엔드포인트 추가 스크립트
├── patch-endpoints.js     # 엔드포인트 패치 스크립트
│
└── css/                   # 노드 관리 UI (선택)
    ├── layout.css
    ├── reset.css
    └── variables.css
```

### 배포 위치
- **서버**: recovery-temp (3.231.220.126)
- **경로**: `~/openhash-node/`
- **포트**: 5001-5004

### 노드 구성
| 포트 | 계층 | ID |
|------|------|-----|
| 5001 | L4 | KR |
| 5002 | L3 | KR-JEJU |
| 5003 | L2 | KR-JEJU-SEOGWIPO |
| 5004 | L1 | KR-JEJU-SEOGWIPO-JUNGMUN |

---

## 5. 서버 구성도
```
┌─────────────────────────────────────────────────────────┐
│  gopang-dev (13.222.8.230)                              │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │  gopang.net     │  │  openhash.kr    │              │
│  │  (웹앱)         │  │  (웹사이트)      │              │
│  │                 │  │                 │              │
│  │  /gopang/       │  │  /openhash/     │              │
│  │  frontend/      │  │  frontend/      │              │
│  └────────┬────────┘  └─────────────────┘              │
│           │                                             │
│  ┌────────▼────────┐  ┌─────────────────┐              │
│  │  Express API    │  │  FastAPI AI     │              │
│  │  :3000          │  │  :8000          │              │
│  └─────────────────┘  └─────────────────┘              │
│                                                         │
│  Nginx (:80, :443) + Let's Encrypt SSL                 │
└─────────────────────────────────────────────────────────┘
                          │
                          │ API 호출
                          ▼
┌─────────────────────────────────────────────────────────┐
│  recovery-temp (3.231.220.126)                          │
│                                                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  :5001   │ │  :5002   │ │  :5003   │ │  :5004   │   │
│  │  L4 KR   │ │  L3 JEJU │ │L2 SEOGWI │ │L1 JUNGMUN│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                         │
│  ~/openhash-node/                                       │
└─────────────────────────────────────────────────────────┘
```

---

## 6. 배포 명령어

### gopang.net 업데이트
```bash
ssh ubuntu@13.222.8.230
cd /gopang
git pull origin main
pm2 restart gopang-backend
```

### openhash.kr 업데이트
```bash
ssh ubuntu@13.222.8.230
cd /openhash/frontend
git pull origin main
```

### 노드 서버 업데이트
```bash
ssh ubuntu@3.231.220.126
cd ~/openhash-node
git pull origin main
# 필요 시 노드 재시작
```

---

## 7. Git 인증 정보

모든 저장소는 동일한 토큰으로 인증됩니다:
```
사용자: Jupeter
토큰: <YOUR_TOKEN>
```

Remote URL 형식:
```
https://Jupeter:TOKEN@github.com/team-jupeter/REPO.git
```

---

*문서 끝*
