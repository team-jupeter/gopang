"""
FastAPI 메타데이터 및 문서 설정
"""

tags_metadata = [
    {
        "name": "서버",
        "description": "서버 상태 및 정보",
    },
    {
        "name": "대화",
        "description": "AI 대화 및 해시 전용 전송",
    },
    {
        "name": "사용자",
        "description": "사용자 및 AI 관리",
    },
    {
        "name": "OpenHash",
        "description": "해시 생성, 계층 전파, 통계",
    },
    {
        "name": "신뢰도",
        "description": "다차원 신뢰도 계산 및 조회",
    },
    {
        "name": "디지털 서명",
        "description": "ECDSA P-256 서명 생성 및 검증",
    },
    {
        "name": "패킷",
        "description": "해시 전용 패킷 파싱 및 대역폭 통계",
    },
]

description = """
## 🏛️ Gopang (고팡) - OpenHash 기반 정부 AI 시스템

**혁신적인 블록체인 대안 기술로 구현한 차세대 정부 AI 통합 플랫폼**

### 핵심 기능

* **OpenHash**: 에너지 효율적 데이터 무결성 (99.999% 절감)
* **계층형 AI**: 4계층 구조 (읍면동 → 시군구 → 광역시도 → 국가)
* **신뢰도 계산**: 다차원 평가 (Network × Layer × Signer × Time × Cross)
* **디지털 서명**: ECDSA P-256 (2^128 보안 강도)
* **해시 전용 전송**: 147바이트 패킷 (최대 99.9999% 대역폭 절약)

### 문서

* **GitHub**: https://github.com/team-jupeter/gopang
* **API Reference**: /docs/API_REFERENCE.md
* **System Manual**: /SYSTEM-MANUAL.md

### 기술 스택

* **Backend**: FastAPI 0.104+
* **AI**: llama.cpp + Qwen2.5 (0.5B, 3B)
* **Database**: SQLite 3.37+
* **Crypto**: cryptography (ECDSA P-256)
"""

app_config = {
    "title": "Gopang API",
    "description": description,
    "version": "3.2.0",
    "openapi_tags": tags_metadata,
    "contact": {
        "name": "Team Jupeter",
        "url": "https://github.com/team-jupeter/gopang",
    },
    "license_info": {
        "name": "MIT",
        "url": "https://opensource.org/licenses/MIT",
    },
}
