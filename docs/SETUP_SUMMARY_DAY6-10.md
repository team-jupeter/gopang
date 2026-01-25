# 고팡(Gopang) 백엔드 구축 요약서

**작성일**: 2026년 1월 22일  
**Phase**: 1 (환경 설정 및 기반 구축)  
**진행**: Day 6 ~ Day 10 완료

---

## Day 6: Express 프로젝트 초기화 ✅

| 항목 | 상태 | 비고 |
|------|------|------|
| npm 초기화 | ✅ | package.json 생성 |
| 핵심 패키지 | ✅ | express, cors, helmet, compression, morgan, dotenv, jsonwebtoken, bcryptjs, uuid, better-sqlite3, socket.io |
| 개발 의존성 | ✅ | typescript, ts-node, nodemon, jest, @types/* |
| 디렉토리 구조 | ✅ | src/{routes,services,middlewares,utils,types,config} |
| 총 패키지 수 | ✅ | 351개 |

### 디렉토리 구조
```
/gopang/backend/
├── package.json
├── node_modules/
└── src/
    ├── routes/
    ├── services/
    ├── middlewares/
    ├── utils/
    ├── types/
    └── config/
```

---

## Day 7: TypeScript 설정 및 Secrets Manager 연동 ✅

| 항목 | 상태 | 비고 |
|------|------|------|
| tsconfig.json | ✅ | ES2022, strict 모드 |
| gopang/jwt-secret | ✅ | Secrets Manager 생성 |
| gopang/db-encryption-key | ✅ | Secrets Manager 생성 |
| secrets.ts 유틸리티 | ✅ | 캐시 5분 TTL |
| config/index.ts | ✅ | 중앙화된 설정 |
| TypeScript 컴파일 | ✅ | 에러 없음 |

### Secrets Manager ARN
- gopang/jwt-secret: arn:aws:secretsmanager:us-east-1:193452400412:secret:gopang/jwt-secret-nuZT1B
- gopang/db-encryption-key: arn:aws:secretsmanager:us-east-1:193452400412:secret:gopang/db-encryption-key-Jwlxwn

### IAM 정책 추가
- SecretsManagerReadWrite → gopang-ec2-role

---

## Day 8: SQLite 연결, 스키마, 자동 백업 ✅

| 항목 | 상태 | 비고 |
|------|------|------|
| better-sqlite3 연결 | ✅ | WAL 모드 활성화 |
| 8개 테이블 생성 | ✅ | 아래 목록 참조 |
| 인덱스 생성 | ✅ | 8개 인덱스 |
| S3 백업 버킷 | ✅ | gopang-backups-193452400412 |
| 자동 백업 cron | ✅ | 매일 자정 실행 |

### 8개 테이블
1. users - 사용자 (human/ai/business)
2. gopang_ais - 기관 AI
3. vaults - 개인 금고
4. vault_drawers - 금고 서랍 (6가지 유형)
5. conversations - 대화
6. messages - 메시지
7. transactions - EGCT 거래
8. audit_logs - 감사 로그

### 데이터베이스 위치
- /gopang/data/db/gopang.db

### IAM 정책 추가
- AmazonS3FullAccess → gopang-ec2-role

---

## Day 9: JWT 인증 시스템 ✅

| 항목 | 상태 | 비고 |
|------|------|------|
| AuthService | ✅ | register, login, logout |
| 비밀번호 해싱 | ✅ | bcrypt 12라운드 |
| Access Token | ✅ | 24시간 만료 |
| Refresh Token | ✅ | 7일 만료 |
| 토큰 검증 | ✅ | verifyToken |
| 토큰 갱신 | ✅ | refreshAccessToken |
| 계정 잠금 | ✅ | 5회 실패 → 15분 잠금 |
| 인증 미들웨어 | ✅ | authenticate, optionalAuth |

### 주요 파일
- src/services/auth.ts - 인증 서비스
- src/middlewares/auth.ts - 인증 미들웨어

---

## Day 10: 기본 API 라우트 및 Rate Limiting ✅

| 항목 | 상태 | 비고 |
|------|------|------|
| express-rate-limit | ✅ | 설치 완료 |
| API Rate Limiting | ✅ | 분당 100회 |
| Auth Rate Limiting | ✅ | 분당 10회 |
| X-Request-ID | ✅ | 모든 응답에 포함 |
| /api/health | ✅ | 서버 상태 확인 |
| /api/auth/* | ✅ | register, login, refresh, logout, me |
| /api/users/* | ✅ | 목록, 조회, 수정 |
| 보안 미들웨어 | ✅ | helmet, cors, compression, morgan |

### API 엔드포인트
```
GET   /api/health          - 서버 상태
POST  /api/auth/register   - 회원가입
POST  /api/auth/login      - 로그인
POST  /api/auth/refresh    - 토큰 갱신
POST  /api/auth/logout     - 로그아웃
GET   /api/auth/me         - 내 정보
GET   /api/users           - 사용자 목록
GET   /api/users/:id       - 사용자 조회
PATCH /api/users/me        - 내 정보 수정
```

### 서버 시작
```bash
cd /gopang/backend && npx ts-node src/index.ts
```

---

## 현재 백엔드 구조
```
/gopang/backend/
├── package.json
├── tsconfig.json
└── src/
    ├── app.ts              # Express 앱
    ├── index.ts            # 서버 시작점
    ├── config/
    │   └── index.ts        # 환경 설정
    ├── services/
    │   ├── database.ts     # SQLite 연결
    │   └── auth.ts         # 인증 서비스
    ├── middlewares/
    │   ├── auth.ts         # 인증 미들웨어
    │   └── rateLimiter.ts  # Rate Limiting
    ├── routes/
    │   ├── health.ts       # Health API
    │   ├── auth.ts         # Auth API
    │   └── users.ts        # Users API
    └── utils/
        └── secrets.ts      # Secrets Manager
```

---

## gopang-ec2-role IAM 정책 목록

| 정책 | 용도 |
|------|------|
| AmazonElasticFileSystemFullAccess | EFS 접근 |
| AWSBackupFullAccess | 백업 관리 |
| SecretsManagerReadWrite | 시크릿 관리 |
| AmazonS3FullAccess | S3 백업 |

---

## 다음 단계

- Day 11: Socket.IO 서버 설정
- Day 12: 인증 미들웨어 (Socket.IO)
- Day 13: 메시지 핸들러
- Day 14: 이벤트 타입 정의
- Day 15: 연결 관리자 및 재연결 로직

---

**문서 끝**
