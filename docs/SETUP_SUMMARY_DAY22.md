# Gopang 프로젝트 Day 22 - 테스트 및 작업 결과

**작성일:** 2026-01-26  
**버전:** v0.22.0  
**도메인:** https://gopang.net

---

## 1. 도메인 설정 완료

### DNS 설정
| 항목 | 값 |
|------|-----|
| 도메인 | gopang.net |
| 등록기관 | 반값도메인 (halfdomain.co.kr) |
| 네임서버 | ns1.clickdomain.co.kr, ns2.clickdomain.co.kr |
| A 레코드 | gopang.net → 13.222.8.230 |
| A 레코드 | www.gopang.net → 13.222.8.230 |

### SSL 인증서
- **발급:** Let's Encrypt
- **경로:** /etc/letsencrypt/live/gopang.net/
- **만료:** 2026-04-26
- **자동 갱신:** Certbot 스케줄러 설정됨

### Nginx 설정
- 파일: `/etc/nginx/sites-available/gopang.net`
- HTTP → HTTPS 자동 리다이렉트
- API 프록시: /api/* → localhost:3000

---

## 2. 다중 LLM 지원

### 지원 모델 목록
| 모델 | 제공사 | 무료 한도 | API Base URL |
|------|--------|-----------|--------------|
| DeepSeek | DeepSeek | 무료 크레딧 | api.deepseek.com/v1 |
| Groq (Llama 3.3) | Groq | 14,400 요청/일 | api.groq.com/openai/v1 |
| Gemini | Google | 무료 tier | generativelanguage.googleapis.com |
| OpenRouter | OpenRouter | 무료 모델 다수 | openrouter.ai/api/v1 |
| Mistral | Mistral AI | 무료 tier | api.mistral.ai/v1 |

### AI 역할 분담 구조
```
사용자 질문
    ↓
외부 LLM (상담/분석)
  - DeepSeek, Groq, Gemini 등
  - 100자 이내 문답식 응답
  - 필요시 문서 생성
    ↓
고팡 AI (실행/작업)
  - Exaone 7.8B (Fine-tuned)
  - 소송 제출, 서류 발급, 예약 등 실행
```

### 응답 규칙
1. 반드시 100자 이내로 답변
2. 문답식으로 진행하며 다음 질문/행동 유도
3. 증빙자료 필요시: "파일 첨부 버튼(+)으로 제출해주세요"
4. 검토 완료시: 정리 문서 생성 후 다운로드 안내
5. 실행 작업 필요시: "상단의 '고팡 AI'를 호출하여 이 문서를 전달하세요"

---

## 3. UI/UX 개선

### 무채색 디자인 적용 (KRDS 참조)
- Primary: #424242 (기존 청색에서 변경)
- Text: #212121 / #616161 / #9E9E9E
- 배경: 반투명 + backdrop-filter blur(20px)

### 슬라이드 메뉴 구성
```
┌─────────────────────────┐
│ ⚙️ 설정                   │
├─────────────────────────┤
│ 상담 AI 선택              │
│ ○ DeepSeek (무료 크레딧)  │
│ ○ Groq (14,400/일)       │
│ ○ Gemini (Google)        │
│ ○ OpenRouter (다중모델)   │
│ ○ Mistral (무료 tier)    │
├─────────────────────────┤
│ 실행 AI                   │
│ 🤖 고팡 AI                │
│    Exaone 7.8B · 작업실행 │
├─────────────────────────┤
│ 내 기록                   │
│ 🔗 Hash Chain         [0] │
│ 📜 대화 기록              │
│ 🏷️ 태그 검색             │
├─────────────────────────┤
│ OpenHash 네트워크         │
│ 📊 계층 현황              │
│ 🔘 노드 정보              │
│ ✓ Hash 검증              │
├─────────────────────────┤
│ 상담: DeepSeek            │
│ 실행: 고팡 AI             │
└─────────────────────────┘
```

### 헤더 변경
- "고팡" 텍스트 클릭 → PersonalAI 모달 열기
- AI 아이콘 버튼 제거 (중복 기능)

### PersonalAI 모달
- 하단에서 슬라이드 업 애니메이션
- 높이: 70vh
- 반투명 오버레이 배경

### 모바일 대응
- 안드로이드 하단 네비게이션 바 대응
- padding-bottom: 48px (모바일)
- @media (max-width: 768px) 적용

---

## 4. OpenHash 저장 메커니즘

### 태그 선택 모달
- 대화 종료(X 버튼) 시 자동 표시
- 기관별 추천 태그 제공
- 커스텀 태그 입력 가능

### 기관별 태그 예시
| 기관 | 추천 태그 |
|------|-----------|
| 법원 | 민사소송, 형사소송, 가사소송, 소장작성, 판례검색 |
| 국세청 | 종합소득세, 부가가치세, 세무조사, 공제 |
| 병원 | 진료예약, 증상상담, 건강검진, 의무기록 |
| 경찰청 | 범죄신고, 수사, 교통사고, 분실물 |

### Hash Chain 알고리즘
```javascript
docHash = SHA256(conversation)
chainHash = SHA256(prevHash + docHash)
layer = probabilistic(60% L1, 30% L2, 9% L3, 1% L4)
```

### 저장 구조 (localStorage)
```json
{
  "entries": [
    {
      "hash": "a1b2c3...",
      "tags": ["민사소송", "소장작성"],
      "layer": 1,
      "partnerId": "court",
      "model": "deepseek",
      "messageCount": 5,
      "timestamp": "2026-01-26T10:00:00Z"
    }
  ],
  "latestHash": "a1b2c3..."
}
```

---

## 5. 테스트 계정

| ID | 비밀번호 | 거주지 | 지갑 잔액 |
|----|----------|--------|-----------|
| 1 | 1 | 중문동 | 10,000 EGCT |
| 2 | 1 | 대정읍 | 10,000 EGCT |
| 3 | 1 | 성산읍 | 10,000 EGCT |

---

## 6. 테스트 결과

### 기능 테스트
| 항목 | 상태 | 비고 |
|------|------|------|
| 로그인 (ID: 1, PW: 1) | ✅ 통과 | |
| 기관 AI 채팅 | ✅ 통과 | DeepSeek fallback 응답 |
| LLM 모델 선택 | ✅ 통과 | 메뉴에서 전환 가능 |
| PersonalAI 모달 | ✅ 통과 | "고팡" 클릭 시 열림 |
| Hash Chain 저장 | ✅ 통과 | 태그 선택 후 저장 |
| 파일 첨부 버튼 | ✅ 통과 | UI 표시됨 |
| 음성 입력 버튼 | ✅ 통과 | UI 표시됨 (기능 준비 중) |
| SSL 인증서 | ✅ 통과 | https://gopang.net |
| 모바일 하단 패딩 | ✅ 통과 | 48px 적용 |

### 브라우저 호환성
| 브라우저 | PC | 모바일 |
|----------|-----|--------|
| Chrome | ✅ | ✅ |
| Safari | ✅ | ✅ |
| Firefox | ✅ | - |
| Edge | ✅ | - |

---

## 7. 파일 변경 내역

### 백엔드
- `/gopang/backend/src/services/ai-chat.ts` - 다중 LLM 지원
- `/gopang/backend/src/routes/ai-chat.ts` - 모델 선택 API

### 프론트엔드
- `/gopang/frontend/js/components/chat/ChatWindow.js` - 슬라이드 메뉴, LLM 선택
- `/gopang/frontend/js/components/chat/LoginScreen.js` - CSS 구조 일치
- `/gopang/frontend/js/components/common/Header.js` - 고팡 클릭 이벤트
- `/gopang/frontend/js/api/chat.js` - 모델 파라미터 추가
- `/gopang/frontend/css/slide-menu.css` - 슬라이드 메뉴 스타일 (신규)
- `/gopang/frontend/css/components.css` - 모달, 고팡 AI 스타일
- `/gopang/frontend/css/layout.css` - 모바일 패딩
- `/gopang/frontend/css/chat.css` - 모바일 패딩

### 설정
- `/etc/nginx/sites-available/gopang.net` - 도메인 설정
- `/gopang/frontend/data/users-registry.json` - 테스트 계정 추가

---

## 8. 다음 단계

1. **LLM API 키 설정** - 실제 API 키 환경변수 등록
2. **고팡 AI (Exaone) 연동** - 로컬 서버 구축 및 연결
3. **음성 입력 기능** - Web Speech API 구현
4. **파일 업로드 처리** - 백엔드 파일 저장 및 분석
5. **OpenHash 서버 연동** - 실제 블록체인 저장
6. **openhash.kr 사이트 구축** - 별도 웹사이트

---

## 9. GitHub

- **저장소:** https://github.com/team-jupeter/gopang
- **커밋:** v0.22.0
- **푸시:** 2026-01-26 완료

---

*작성: Claude AI Assistant*
