# GOPANG & OpenHash 설정 요약 - Day 23

**작성일**: 2026-01-26
**작성자**: Claude + Jupiter
**환경**: AWS EC2 (gopang-dev, recovery-temp)

---

## 1. 오늘 작업 요약

### 1.1 OpenHash UI 전면 재디자인
정부 표준 웹사이트 가이드라인에 따라 OpenHash 웹사이트를 전면 재디자인했습니다.

| 항목 | Before | After |
|------|--------|-------|
| 색상 | 파란 그라데이션, 5색 무지개 | 네이비(#1a3a6e) + 골드(#d4a017) |
| 네비게이션 | 흰색 배경 | 네이비 배경 + 골드 라인 |
| Hero | 화려한 그라데이션 | 단색 네이비 |
| 카드 | hover 시 transform + shadow | border-color만 변경 |
| 애니메이션 | pulse, transform | 최소화 |
| 전체 톤 | 산만함 | 미니멀, 전문적 |

### 1.2 업데이트된 페이지 목록

**공통 CSS (3개)**
- `/style.css` - 메인 스타일
- `/technology/tech-common.css` - 기술 페이지 공통
- `/simulation/sim-common.css` - 시뮬레이션 페이지 공통

**인덱스 페이지 (4개)**
- `/index.html` - 홈페이지
- `/technology/index.html` - 기술 문서 목록
- `/simulation/index.html` - 시뮬레이션 목록
- `/tests/index.html` - 테스트 센터

**기술 상세 페이지 (8개)**
- `hierarchy.html` - 5단계 계층 구조
- `verification.html` - 검증 시스템
- `consensus.html` - LPBFT 합의
- `layer-select.html` - 확률적 계층 선택
- `ssi.html` - SSI 인증
- `currency.html` - 디지털 화폐
- `vault.html` - Vault 서비스
- `hashchain.html` - 해시 체인

**시뮬레이션 상세 페이지 (6개)**
- `transaction.html` - 거래 시뮬레이션
- `layer-select.html` - 계층 선택 시뮬레이션
- `verification.html` - 5단계 검증 시뮬레이션
- `lpbft.html` - LPBFT 합의 시뮬레이션
- `ssi.html` - SSI 인증 시뮬레이션
- `hashchain.html` - 해시 체인 시뮬레이션

**테스트 카테고리 페이지 (11개)**
- `category-a.html` ~ `category-k.html` (A~K)
- 총 64개 테스트 항목

---

## 2. 저장소 분리

기존 2개 저장소를 3개로 분리하여 명확한 역할 구분을 완료했습니다.

### 2.1 분리 전
```
gopang          → gopang.net 웹앱 + 백엔드
openhash-node   → 4계층 노드 + 웹사이트 (혼합)
```

### 2.2 분리 후
| 저장소 | URL | 용도 |
|--------|-----|------|
| **gopang** | github.com/team-jupeter/gopang | gopang.net 웹앱 |
| **openhash-website** 🆕 | github.com/team-jupeter/openhash-website | openhash.kr 웹사이트 |
| **openhash-node** | github.com/team-jupeter/openhash-node | 4계층 노드 서버 |

---

## 3. 서버 구성

### 3.1 gopang-dev (13.222.8.230)
```
역할: 웹사이트 서버
├── /gopang/            → gopang 저장소
│   ├── frontend/       → gopang.net (웹앱)
│   ├── backend/        → Express API (포트 3000)
│   └── ai-engine/      → FastAPI (포트 8000)
│
└── /openhash/frontend/ → openhash-website 저장소
    └── openhash.kr (정적 웹사이트)

서비스:
- Nginx (80, 443)
- PM2: gopang-backend (3000)
- systemd: gopang-ai (8000)
- llama-server (8080)
```

### 3.2 recovery-temp (3.231.220.126)
```
역할: 노드 서버
└── ~/openhash-node/    → openhash-node 저장소
    └── node-service.js

서비스:
- 5001: L4 KR (국가)
- 5002: L3 KR-JEJU (광역시도)
- 5003: L2 KR-JEJU-SEOGWIPO (시군구)
- 5004: L1 KR-JEJU-SEOGWIPO-JUNGMUN (읍면동)
```

---

## 4. 디자인 시스템

### 4.1 색상 팔레트
```css
/* Primary */
--primary: #1a3a6e;      /* 네이비 */
--primary-dark: #0f2442;
--accent: #d4a017;       /* 골드 */

/* Semantic */
--success: #0d6832;
--warning: #e67700;
--error: #c92a2a;

/* Neutral */
--gray-900: #212529;
--gray-700: #495057;
--gray-500: #868e96;
--gray-300: #dee2e6;
--gray-100: #f1f3f5;
```

### 4.2 타이포그래피
```css
--font-sans: 'Noto Sans KR', sans-serif;
--font-mono: 'JetBrains Mono', monospace;

/* 크기 */
제목: 28px, 700 weight
부제목: 15px, 400 weight
본문: 14-15px, 1.6 line-height
코드: 13px, monospace
```

### 4.3 레이아웃
```css
최대 너비: 1200px
네비게이션 높이: 56px
섹션 패딩: 64px (상하)
카드 패딩: 24px
간격: 4px 배수 시스템
```

---

## 5. 배포 명령어

### 5.1 openhash.kr 업데이트
```bash
# gopang-dev에서 실행
cd /openhash/frontend
git pull origin main
```

### 5.2 gopang.net 업데이트
```bash
# gopang-dev에서 실행
cd /gopang
git pull origin main
sudo systemctl reload nginx
pm2 restart gopang-backend
```

### 5.3 노드 서버 업데이트
```bash
# recovery-temp에서 실행
cd ~/openhash-node
git pull origin main
# 노드 재시작 필요 시
pkill -f node-service.js
./start-nodes.sh  # 또는 수동 실행
```

---

## 6. 검증 결과

### 6.1 웹사이트 접속
| URL | 상태 |
|-----|------|
| https://openhash.kr | ✅ 200 OK |
| https://gopang.net | ✅ 200 OK |

### 6.2 노드 헬스체크
| 포트 | 계층 | 상태 |
|------|------|------|
| 5001 | L4 KR | ✅ healthy |
| 5002 | L3 KR-JEJU | ✅ healthy |
| 5003 | L2 KR-JEJU-SEOGWIPO | ✅ healthy |
| 5004 | L1 KR-JEJU-SEOGWIPO-JUNGMUN | ✅ healthy |

---

## 7. GitHub 저장소

| 저장소 | 최종 커밋 |
|--------|----------|
| [gopang](https://github.com/team-jupeter/gopang) | 테스트 v1.0 완료 |
| [openhash-website](https://github.com/team-jupeter/openhash-website) | 🆕 초기 커밋 (정부 표준 디자인) |
| [openhash-node](https://github.com/team-jupeter/openhash-node) | frontend/ 분리 완료 |

---

## 8. 다음 작업 (TODO)

- [ ] 테스트 센터 실제 API 연동 (recovery-temp 노드)
- [ ] 시뮬레이션 JavaScript 기능 검증
- [ ] 모바일 반응형 테스트
- [ ] 노드 서버 PM2 데몬화 (recovery-temp)
- [ ] CI/CD 파이프라인 구축

---

*문서 끝*
