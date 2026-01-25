# 고팡(Gopang) Socket.IO 구축 요약서

**작성일**: 2026년 1월 23일  
**Phase**: 1 (환경 설정 및 기반 구축)  
**진행**: Day 11 ~ Day 15 완료 (3주차)

---

## Day 11: Socket.IO 서버 설정 ✅

| 항목 | 상태 | 비고 |
|------|------|------|
| Socket.IO 서버 | ✅ | HTTP 서버에 통합 |
| CORS 설정 | ✅ | 모든 origin 허용 |
| pingTimeout | ✅ | 60초 |
| pingInterval | ✅ | 25초 |
| 최대 연결 수 | ✅ | 100개 제한 |
| 연결/해제 로깅 | ✅ | 실시간 로그 |
| Health API 연동 | ✅ | 연결 수 표시 |

### 주요 파일
- src/socket/index.ts

---

## Day 12: Socket.IO 인증 미들웨어 ✅

| 항목 | 상태 | 비고 |
|------|------|------|
| 인증 미들웨어 | ✅ | socketAuthMiddleware |
| JWT 토큰 검증 | ✅ | handshake.auth.token |
| socket.data.user | ✅ | 사용자 정보 저장 |
| 토큰 만료 알림 | ✅ | 만료 10분 전 token:refresh 이벤트 |
| 사용자별 룸 | ✅ | user:{userId} 룸 자동 참가 |

### 주요 파일
- src/socket/authMiddleware.ts

---

## Day 13: 메시지 핸들러 ✅

| 항목 | 상태 | 비고 |
|------|------|------|
| message:send | ✅ | 메시지 전송 및 DB 저장 |
| message:status | ✅ | 수신 확인 (sent/delivered/read) |
| message:new | ✅ | 대화방 브로드캐스트 |
| message:read | ✅ | 읽음 처리 |
| gopang:status | ✅ | processing/completed/error/timeout |
| conversation:join | ✅ | 대화방 참가 |
| conversation:leave | ✅ | 대화방 나가기 |
| 30초 타임아웃 | ✅ | 시간 초과 시 timeout 상태 |

### 주요 파일
- src/socket/messageHandler.ts

---

## Day 14: 이벤트 타입 정의 ✅

| 카테고리 | 이벤트 수 | 이벤트 목록 |
|----------|----------|-------------|
| 메시지 관련 | 4개 | message:send, message:new, message:status, message:read |
| 고팡 상태 | 3개 | gopang:status, gopang:ai_response, gopang:error |
| 동의 관련 | 3개 | consent:request, consent:respond, consent:status |
| 거래 관련 | 4개 | transaction:create, transaction:status, transaction:verify, transaction:complete |
| 오픈해시 관련 | 3개 | openhash:record, openhash:verify, openhash:sync |
| 금고 관련 | 3개 | vault:access, vault:content, vault:proof |
| **합계** | **20개** | |

### 주요 파일
- src/types/socket.ts

---

## Day 15: 연결 관리자 및 재연결 로직 ✅

| 항목 | 상태 | 비고 |
|------|------|------|
| ConnectionManager | ✅ | 사용자별 연결 관리 |
| 다중 연결 지원 | ✅ | 최대 3개/사용자 |
| 초과 시 자동 종료 | ✅ | 가장 오래된 연결 종료 |
| connection:replaced 이벤트 | ✅ | 종료 알림 |
| 미수신 메시지 동기화 | ✅ | sync:request → messages:sync |
| 연결 통계 | ✅ | getConnectionStats() |

### 주요 파일
- src/socket/connectionManager.ts

---

## 현재 백엔드 구조
```
/gopang/backend/src/
├── app.ts
├── index.ts
├── config/
│   └── index.ts
├── services/
│   ├── database.ts
│   └── auth.ts
├── middlewares/
│   ├── auth.ts
│   └── rateLimiter.ts
├── routes/
│   ├── health.ts
│   ├── auth.ts
│   └── users.ts
├── socket/
│   ├── index.ts
│   ├── authMiddleware.ts
│   ├── messageHandler.ts
│   └── connectionManager.ts
├── types/
│   └── socket.ts
└── utils/
    └── secrets.ts
```

---

## Socket.IO 이벤트 요약

### 서버 → 클라이언트
- connected: 연결 성공
- error: 에러 발생
- token:refresh: 토큰 갱신 필요
- connection:replaced: 다른 기기 접속으로 종료
- message:new: 새 메시지 도착
- message:status: 메시지 상태 변경
- messages:sync: 미수신 메시지 동기화
- gopang:status: 처리 상태

### 클라이언트 → 서버
- ping: 연결 확인
- message:send: 메시지 전송
- message:read: 읽음 처리
- conversation:join: 대화방 참가
- conversation:leave: 대화방 나가기
- sync:request: 미수신 메시지 요청

---

## Phase 1 검증 게이트 진행 상황

| 항목 | 상태 |
|------|------|
| 1. 스왑 메모리 8GB 이상 | ✅ |
| 2. EFS 마운트 및 백업 설정 완료 | ✅ |
| 3. Node.js 20 버전 | ✅ |
| 4. HTTPS 준비 완료 (Nginx, Certbot) | ✅ |
| 5. Secrets Manager 연동 | ✅ |
| 6. Health API 정상 응답 | ✅ |
| 7. 데이터베이스 연결 및 백업 설정 | ✅ |
| 8. JWT 인증 및 Rate Limiting 동작 | ✅ |
| 9. 8개 테이블 생성 완료 | ✅ |
| 10. Socket.IO 연결 및 재연결 로직 | ✅ |
| 11. Vault/거래 서비스 동작 | ⏳ Day 16-19 |
| 12. 인프라 구성도 및 API 명세서 초안 완성 | ⏳ Day 20 |

**현재 진행률**: 10/12 (83%)

---

## 다음 단계 (4주차)

- Day 16: Vault 서비스 기초
- Day 17: 서랍 관리 로직
- Day 18: 거래 서비스 기초
- Day 19: 거래 검증 로직
- Day 20: Phase 1 통합 테스트 및 문서화

---

**문서 끝**
