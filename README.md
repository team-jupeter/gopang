# 고팡 (Gopang) - AI 통합 플랫폼 프로토타입

OpenHash 기반 AI 통합 플랫폼

## 시스템 구성

### 인프라
- **AWS EC2**: t2.medium (2 vCPU, 4GB RAM, 30GB SSD)
- **OS**: Amazon Linux 2023

### AI 모델
- **Qwen 0.5B**: 개인 비서 AI (Port 8001)
- **Qwen 3B**: 기관 AI (Port 8002)
- **백엔드**: llama.cpp + llama-server

### 서버 스택
- **웹 서버**: Nginx (Port 80) - 리버스 프록시
- **AI API**: FastAPI (Port 8000) - Python 3.11
- **WebSocket**: Socket.IO (Port 3000) - Node.js 20
- **AI 추론**: llama-server (Port 8001, 8002)

## 디렉토리 구조
```
gopang/
├── ai-server/           # AI 서버
│   ├── models/         # Qwen 모델 파일 (.gguf)
│   ├── prompts/        # System Prompt 파일
│   ├── ai_server.py    # FastAPI 서버
│   ├── server.js       # Socket.IO 서버
│   └── package.json
├── llama.cpp/          # llama.cpp (빌드됨)
│   └── build/bin/
│       ├── llama-cli
│       └── llama-server
├── scripts/            # 관리 스크립트
│   ├── start-services.sh
│   ├── stop-services.sh
│   ├── restart-services.sh
│   ├── view-logs.sh
│   └── health-check.sh
├── logs/              # 로그 파일
└── venv/             # Python 가상환경
```

## 설치 및 실행

### 서비스 관리
```bash
# 헬스 체크
gopang-health

# 서비스 시작
gopang-start

# 서비스 재시작
gopang-restart

# 로그 확인
gopang-logs
```

### systemd 서비스
- `llama-server-0.5b.service` - Qwen 0.5B
- `llama-server-3b.service` - Qwen 3B
- `gopang-ai.service` - FastAPI
- `gopang-socket.service` - Socket.IO
- `nginx.service` - Nginx

## API 엔드포인트

### FastAPI (http://server-ip/api/)
- `GET /` - 서버 정보
- `GET /health` - 헬스체크
- `POST /chat` - AI 채팅

### Socket.IO (ws://server-ip:3000)
- `send_message` - 메시지 전송
- `receive_message` - AI 응답 수신

## 메모리 사용량

- Qwen 0.5B: ~571MB
- Qwen 3B: ~3.4GB
- FastAPI/Node.js: ~200MB
- Nginx: ~50MB
- **총**: ~4GB 중 약 3.3GB 사용 (여유: 700MB)

## 기술 스택

- **AI**: Qwen2.5 (GGUF Q4_K_M 양자화)
- **추론 엔진**: llama.cpp
- **백엔드**: FastAPI, Socket.IO
- **프론트 프록시**: Nginx
- **서비스 관리**: systemd
- **개발 환경**: Python 3.11, Node.js 20

## 작성자

- **프로젝트 관리**: 주피터 (Jupiter)
- **날짜**: 2025-12-30
- **저장소**: https://github.com/team-jupeter/gopang

## 라이선스

MIT License
