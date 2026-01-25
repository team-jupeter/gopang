# GOPANG 인증 전략

## 환경별 인증 방식

| 환경 | 인증 방식 | 비고 |
|------|----------|------|
| 테스트/시뮬레이션 | 전화번호 + 비밀번호 "1" | 개발/검증용 |
| 상용 (기본) | WebAuthn 생체인증 | 지문/Face ID |
| 상용 (강화) | 생체 + SMS OTP | 사용자 선택 |
| 상용 (최고) | 생체 + SMS + PIN | 고액 거래 |

## 테스트 환경 로그인
```
ID: 82-010-6412-0001 (또는 SGP-JM-01)
PW: 1
```

## 상용 환경 보안 등급 (사용자 선택)

### Level 1: 기본 (Default)
- WebAuthn 생체인증 (지문/Face ID)
- 일반 거래 한도: 100만원/일

### Level 2: 강화
- 생체인증 + SMS OTP (거래 시)
- 거래 한도: 500만원/일

### Level 3: 최고
- 생체인증 + SMS OTP + 6자리 PIN
- 거래 한도: 무제한
- 새 디바이스 등록 시 본인확인 필요

## WebAuthn 구현 (상용)
```javascript
// 등록 (Registration)
const credential = await navigator.credentials.create({
  publicKey: {
    challenge: serverChallenge,
    rp: { name: "GOPANG", id: "gopang.kr" },
    user: {
      id: userIdBuffer,
      name: "82-010-6412-0001",
      displayName: "중문동주민1"
    },
    pubKeyCredParams: [
      { alg: -7, type: "public-key" },   // ES256
      { alg: -257, type: "public-key" }  // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: "platform",  // 내장 생체인증
      userVerification: "required"
    }
  }
});

// 인증 (Authentication)
const assertion = await navigator.credentials.get({
  publicKey: {
    challenge: serverChallenge,
    allowCredentials: [{ id: credentialId, type: "public-key" }],
    userVerification: "required"
  }
});
```

## 보안 정책

1. **디바이스 바인딩**: 생체인증 키는 디바이스에만 저장
2. **도메인 바인딩**: 피싱 사이트에서 인증 불가
3. **재등록**: 새 디바이스는 SMS 인증 후 생체 재등록
4. **고액 거래**: 100만원 초과 시 추가 인증 요구
5. **이상 탐지**: 비정상 접속 패턴 시 강화 인증

## 마이그레이션 계획
```
Phase 1 (현재): 전화번호 + 비밀번호
Phase 2: SMS OTP 추가 (선택)
Phase 3: WebAuthn 도입 (기본)
Phase 4: 사용자 보안등급 선택
```
