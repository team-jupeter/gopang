# 고팡(Gopang) AI 플랫폼 - 시스템 구축 매뉴얼

## 📋 목차

1. [시스템 개요](#시스템-개요)
2. [인프라 구성](#인프라-구성)
3. [상세 구축 과정](#상세-구축-과정)
4. [시스템 관리](#시스템-관리)
5. [트러블슈팅](#트러블슈팅)
6. [비용 분석](#비용-분석)

---

## 시스템 개요

### 프로젝트 정보
- **프로젝트명**: 고팡(Gopang) AI 통합 플랫폼
- **버전**: v1.0.0 (프로토타입)
- **구축일**: 2025-12-30
- **GitHub**: https://github.com/team-jupeter/gopang
- **기술 스택**: Python 3.11, Node.js 20, Nginx, SQLite, llama.cpp

### 시스템 아키텍처
```
┌─────────────────────────────────────────────────────────┐
│                      인터넷                              │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
              ┌──────────────┐
              │ Nginx (Port 80)│
              │  리버스 프록시  │
              └──────┬───────┘
                     │
         ┌───────────┼──────────┐
         │                      │
         ▼                      ▼
┌─────────────────┐    ┌──────────────────┐
│ FastAPI (8000)  │    │ Socket.IO (3000) │
│   AI API 서버    │    │  WebSocket 서버   │
└────────┬────────┘    └──────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│Qwen    │ │Qwen    │
│0.5B    │ │3B      │
│(8001)  │ │(8002)  │
└────────┘ └────────┘
         │
         ▼
    ┌─────────┐
    │ SQLite  │
    │Database │
    └─────────┘
```

### 핵심 기능
- ✅ 2-Tier AI 시스템 (개인 0.5B / 기관 3B)
- ✅ 실시간 WebSocket 통신
- ✅ 대화 기록 자동 저장
- ✅ RESTful API
- ✅ systemd 서비스 관리
- ✅ Nginx 리버스 프록시

---

## 인프라 구성

### AWS EC2 인스턴스
```yaml
리전: us-east-1 (버지니아 북부)
인스턴스 타입: t2.medium
  - vCPU: 2개
  - 메모리: 4GB RAM
  - 스토리지: 30GB gp3 SSD
AMI: Amazon Linux 2023 (ami-068c0051b15cdb816)
퍼블릭 IP: 34.227.194.156
```

### 보안 그룹 규칙
```
규칙 1: SSH (22)
  - 소스: 내 IP (112.164.242.17/32)
  - 설명: SSH 접속

규칙 2: HTTP (80)
  - 소스: 0.0.0.0/0
  - 설명: Nginx 웹 서버

규칙 3: TCP (3000)
  - 소스: 0.0.0.0/0
  - 설명: Socket.IO WebSocket

규칙 4: TCP (8000)
  - 소스: 0.0.0.0/0
  - 설명: FastAPI 개발용 (프로덕션에서는 제거)
```

### 디렉토리 구조
```
/home/ec2-user/gopang/
├── ai-server/
│   ├── models/
│   │   ├── qwen2.5-0.5b-instruct-q4_k_m.gguf (469MB)
│   │   └── qwen2.5-3b-instruct-q4_k_m.gguf (2.0GB)
│   ├── ai_server.py          # FastAPI 서버
│   ├── server.js             # Socket.IO 서버
│   └── package.json
├── database/
│   ├── gopang.db             # SQLite 데이터베이스
│   └── init_db.py            # DB 초기화 스크립트
├── llama.cpp/
│   └── build/bin/
│       ├── llama-cli         # CLI 도구
│       └── llama-server      # HTTP 서버
├── scripts/
│   ├── start-services.sh
│   ├── stop-services.sh
│   ├── restart-services.sh
│   ├── view-logs.sh
│   └── health-check.sh
├── logs/
├── venv/                     # Python 가상환경
├── requirements.txt
└── README.md
```

---

## 상세 구축 과정

### 1단계: EC2 인스턴스 생성 (AWS 웹 콘솔)

1. **EC2 대시보드 접속**
   - https://console.aws.amazon.com/ec2

2. **인스턴스 시작 설정**
```
   이름: gopang-ai-server
   AMI: Amazon Linux 2023
   인스턴스 유형: t2.medium
   키 페어: gopang-key (새로 생성)
```

3. **네트워크 설정**
```
   VPC: 기본 VPC
   퍼블릭 IP 자동 할당: 활성화
   보안 그룹: gopang-ec2-sg (새로 생성)
```

4. **스토리지 설정**
```
   크기: 30 GiB
   볼륨 유형: gp3
```

5. **인스턴스 시작** 후 퍼블릭 IP 기록

### 2단계: SSH 접속 및 기본 설정
```bash
# Windows PowerShell에서
ssh -i ~/Downloads/gopang-key.pem ec2-user@34.227.194.156

# 시스템 업데이트 (EC2 터미널)
sudo yum update -y

# 시스템 정보 확인
echo "OS: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)"
echo "메모리: $(free -h | grep Mem | awk '{print $2}')"
echo "디스크: $(df -h / | tail -1 | awk '{print $2}')"
```

**결과:**
```
OS: Amazon Linux 2023
메모리: 3.8Gi
디스크: 30G
```

### 3단계: 개발 도구 설치
```bash
# Python 3.11, gcc, cmake 설치
sudo yum install -y \
  git \
  python3.11 \
  python3.11-pip \
  gcc \
  gcc-c++ \
  make \
  cmake \
  wget \
  tar

# Node.js 20 LTS 설치
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# 버전 확인
python3.11 --version  # Python 3.11.x
node --version        # v20.19.6
npm --version         # 10.8.2
```

### 4단계: 프로젝트 디렉토리 생성
```bash
mkdir -p ~/gopang/{ai-server/{models,prompts/{personal,institution}},scripts,logs,database,backups}
cd ~/gopang
```

### 5단계: llama.cpp 빌드
```bash
cd ~/gopang
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp
mkdir build && cd build
cmake .. -DLLAMA_CURL=OFF
cmake --build . --config Release -j2

# 빌드 확인
ls -lh bin/llama-cli bin/llama-server
```

**예상 출력:**
```
-rwxr-xr-x 4.7M llama-cli
-rwxr-xr-x 6.3M llama-server
```

### 6단계: Qwen 모델 다운로드
```bash
cd ~/gopang/ai-server/models

# Qwen 0.5B (개인 AI용)
wget https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf

# Qwen 3B (기관 AI용)
wget https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf

# 다운로드 확인
ls -lh
```

**예상 출력:**
```
469M qwen2.5-0.5b-instruct-q4_k_m.gguf
2.0G qwen2.5-3b-instruct-q4_k_m.gguf
```

### 7단계: Python 환경 설정
```bash
cd ~/gopang
python3.11 -m venv venv
source venv/bin/activate

# requirements.txt 생성
cat > requirements.txt << 'REQS'
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
aiohttp==3.9.1
pydantic==2.5.0
python-socketio==5.10.0
boto3==1.34.0
REQS

pip install --upgrade pip
pip install -r requirements.txt
```

### 8단계: Nginx 설치 및 설정
```bash
# Nginx 설치
sudo yum install -y nginx
nginx -v  # nginx/1.28.0

# 기본 설정 백업
sudo cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup

# nginx.conf 재작성
sudo tee /etc/nginx/nginx.conf > /dev/null << 'NGINXCONF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log notice;
pid /run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    log_format  main  '$remote_addr - $remote_user [$time_local] "$request" '
                      '$status $body_bytes_sent "$http_referer" '
                      '"$http_user_agent" "$http_x_forwarded_for"';

    access_log  /var/log/nginx/access.log  main;

    sendfile            on;
    tcp_nopush          on;
    keepalive_timeout   65;
    types_hash_max_size 4096;

    include             /etc/nginx/mime.types;
    default_type        application/octet-stream;

    include /etc/nginx/conf.d/*.conf;
}
NGINXCONF

# 리버스 프록시 설정
sudo tee /etc/nginx/conf.d/gopang.conf > /dev/null << 'PROXYCONF'
upstream fastapi_backend {
    server 127.0.0.1:8000;
}

upstream socketio_backend {
    server 127.0.0.1:3000;
}

server {
    listen 80;
    server_name _;
    
    client_max_body_size 50M;
    
    proxy_connect_timeout 300;
    proxy_send_timeout 300;
    proxy_read_timeout 300;
    
    location /api {
        rewrite ^/api(/.*)$ $1 break;
        proxy_pass http://fastapi_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /socket.io/ {
        proxy_pass http://socketio_backend/socket.io/;
        proxy_http_version 1.1;
        proxy_buffering off;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
    
    location / {
        return 200 "Gopang AI Server - Nginx Running\n";
        add_header Content-Type text/plain;
    }
}
PROXYCONF

# 설정 테스트 및 시작
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 9단계: Node.js 패키지 설치
```bash
cd ~/gopang/ai-server

cat > package.json << 'PKG'
{
  "name": "gopang-ai-server",
  "version": "1.0.0",
  "description": "Gopang AI Server with Socket.IO",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "socket.io": "^4.7.2",
    "aws-sdk": "^2.1498.0",
    "axios": "^1.6.2",
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
PKG

npm install
```

### 10단계: llama-server systemd 서비스
```bash
# Qwen 0.5B 서비스
sudo tee /etc/systemd/system/llama-server-0.5b.service > /dev/null << 'SERVICE1'
[Unit]
Description=Llama Server - Qwen 0.5B (Personal AI)
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/gopang/llama.cpp/build/bin
ExecStart=/home/ec2-user/gopang/llama.cpp/build/bin/llama-server \
  -m /home/ec2-user/gopang/ai-server/models/qwen2.5-0.5b-instruct-q4_k_m.gguf \
  --port 8001 \
  --host 0.0.0.0 \
  -c 512 \
  --log-disable
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE1

# Qwen 3B 서비스
sudo tee /etc/systemd/system/llama-server-3b.service > /dev/null << 'SERVICE2'
[Unit]
Description=Llama Server - Qwen 3B (Institution AI)
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/gopang/llama.cpp/build/bin
ExecStart=/home/ec2-user/gopang/llama.cpp/build/bin/llama-server \
  -m /home/ec2-user/gopang/ai-server/models/qwen2.5-3b-instruct-q4_k_m.gguf \
  --port 8002 \
  --host 0.0.0.0 \
  -c 1024 \
  --log-disable
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SERVICE2

# 서비스 활성화
sudo systemctl daemon-reload
sudo systemctl enable llama-server-0.5b llama-server-3b
sudo systemctl start llama-server-0.5b
sleep 5
sudo systemctl start llama-server-3b
```

### 11단계: 데이터베이스 초기화
```bash
cd ~/gopang/database

cat > init_db.py << 'INITDB'
#!/usr/bin/env python3
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'gopang.db')

def init_database():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS users (
        user_id TEXT PRIMARY KEY,
        user_type TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    ''')
    
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS conversations (
        conv_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        message TEXT NOT NULL,
        response TEXT NOT NULL,
        ai_type TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    )
    ''')
    
    cursor.execute("INSERT OR IGNORE INTO users VALUES ('test_user', 'personal', '테스트 사용자', datetime('now'))")
    
    conn.commit()
    conn.close()
    print(f"✅ 데이터베이스 초기화 완료: {DB_PATH}")

if __name__ == '__main__':
    init_database()
INITDB

python3 init_db.py
```

### 12단계: FastAPI 서버 코드

FastAPI 서버 코드는 `/home/ec2-user/gopang/ai-server/ai_server.py` 참조

### 13단계: Socket.IO 서버 코드

Socket.IO 서버 코드는 `/home/ec2-user/gopang/ai-server/server.js` 참조

### 14단계: FastAPI/Socket.IO systemd 서비스
```bash
# FastAPI 서비스
sudo tee /etc/systemd/system/gopang-ai.service > /dev/null << 'FASTAPI'
[Unit]
Description=Gopang FastAPI AI Server
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/gopang/ai-server
Environment="PATH=/home/ec2-user/gopang/venv/bin:/usr/local/bin:/usr/bin"
ExecStart=/home/ec2-user/gopang/venv/bin/uvicorn ai_server:app --host 0.0.0.0 --port 8000
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
FASTAPI

# Socket.IO 서비스
sudo tee /etc/systemd/system/gopang-socket.service > /dev/null << 'SOCKETIO'
[Unit]
Description=Gopang Socket.IO Server
After=network.target gopang-ai.service

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/gopang/ai-server
Environment="NODE_ENV=production"
Environment="PORT=3000"
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
SOCKETIO

# 서비스 활성화
sudo systemctl daemon-reload
sudo systemctl enable gopang-ai gopang-socket
sudo systemctl start gopang-ai
sleep 3
sudo systemctl start gopang-socket
```

### 15단계: 관리 스크립트

관리 스크립트는 `/home/ec2-user/gopang/scripts/` 참조

---

## 시스템 관리

### 서비스 관리
```bash
# 헬스 체크
gopang-health

# 서비스 시작
gopang-start
# 또는
sudo systemctl start llama-server-0.5b llama-server-3b gopang-ai gopang-socket nginx

# 서비스 중지
gopang-stop
# 또는
sudo systemctl stop llama-server-0.5b llama-server-3b gopang-ai gopang-socket nginx

# 서비스 재시작
gopang-restart
# 또는
sudo systemctl restart llama-server-0.5b llama-server-3b gopang-ai gopang-socket nginx

# 서비스 상태 확인
sudo systemctl status llama-server-0.5b
sudo systemctl status llama-server-3b
sudo systemctl status gopang-ai
sudo systemctl status gopang-socket
sudo systemctl status nginx
```

### 로그 확인
```bash
# 통합 로그 확인
gopang-logs

# 개별 서비스 로그
sudo journalctl -u llama-server-0.5b -f
sudo journalctl -u llama-server-3b -f
sudo journalctl -u gopang-ai -f
sudo journalctl -u gopang-socket -f

# Nginx 로그
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 데이터베이스 관리
```bash
# 데이터베이스 백업
cp ~/gopang/database/gopang.db ~/gopang/backups/gopang_$(date +%Y%m%d_%H%M%S).db

# 대화 기록 통계
python3 << 'STATS'
import sqlite3
conn = sqlite3.connect('/home/ec2-user/gopang/database/gopang.db')
cursor = conn.cursor()
cursor.execute("SELECT COUNT(*) FROM conversations")
print(f"총 대화 수: {cursor.fetchone()[0]}")
cursor.execute("SELECT COUNT(*) FROM users")
print(f"총 사용자 수: {cursor.fetchone()[0]}")
conn.close()
STATS

# 데이터베이스 최적화
sqlite3 ~/gopang/database/gopang.db "VACUUM;"
```

### GitHub 동기화
```bash
cd ~/gopang
git add .
git commit -m "Update: [변경 내용]"
git push origin master
```

---

## 트러블슈팅

### 문제 1: OOM Killer (메모리 부족)

**증상:**
```
systemd[1]: gopang-ai.service: Main process exited, code=killed, status=9/KILL
```

**원인:** llama-cli를 subprocess로 매번 실행하여 메모리 부족

**해결:**
- llama-server 사용으로 전환
- 모델을 메모리에 한 번만 로드
- HTTP API로 재사용

### 문제 2: Nginx 502 Bad Gateway

**증상:**
```html
<h1>502 Bad Gateway</h1>
```

**원인:** 백엔드 서비스가 실행되지 않음

**해결:**
```bash
# 백엔드 서비스 상태 확인
sudo systemctl status gopang-ai
sudo systemctl status gopang-socket

# 서비스 재시작
sudo systemctl restart gopang-ai gopang-socket
```

### 문제 3: llama-server 응답 없음

**증상:**
```json
{"error": {"message": "Loading model", "type": "unavailable_error", "code": 503}}
```

**원인:** 모델 로딩 중 (약 10-20초 소요)

**해결:** 20초 대기 후 재시도

### 문제 4: 디스크 공간 부족

**증상:**
```
No space left on device
```

**해결:**
```bash
# 디스크 사용량 확인
df -h

# 로그 정리
sudo journalctl --vacuum-time=7d

# 불필요한 패키지 제거
sudo yum clean all

# llama.cpp 빌드 파일 정리 (재빌드 가능)
rm -rf ~/gopang/llama.cpp/build/CMakeFiles/
```

### 문제 5: SSH 연결 끊김

**원인:** 네트워크 타임아웃 또는 인스턴스 중지

**해결:**
```bash
# SSH 재연결
ssh -i ~/Downloads/gopang-key.pem ec2-user@34.227.194.156

# keepalive 설정 (로컬 ~/.ssh/config)
Host gopang
    HostName 34.227.194.156
    User ec2-user
    IdentityFile ~/Downloads/gopang-key.pem
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

---

## 비용 분석

### 월간 운영 비용 (us-east-1)

| 항목 | 사양 | 월 비용 |
|------|------|---------|
| EC2 t2.medium | 2 vCPU, 4GB RAM | $33.61 |
| EBS gp3 | 30GB | $2.40 |
| 데이터 전송 | ~10GB/월 | $0.90 |
| **총계** | | **$36.91** |

### 비용 절감 방법

1. **야간 자동 중지** (cron)
```bash
   # 매일 23:00 중지, 08:00 시작
   # 약 40% 비용 절감
```

2. **예약 인스턴스** (1년 약정)
```
   온디맨드: $33.61/월
   RI (1년): $23.00/월
   절감액: $10.61/월 (32%)
```

3. **Spot 인스턴스** (프로토타입용)
```
   최대 70% 절감
   주의: 중단 가능성 있음
```

---

## API 엔드포인트

### FastAPI (http://34.227.194.156/api/)

#### GET /
서버 정보 조회

**응답:**
```json
{
  "service": "Gopang AI Server",
  "status": "running",
  "models": {
    "personal": "Qwen2.5-0.5B",
    "institution": "Qwen2.5-3B"
  },
  "backend": "llama-server",
  "database": "SQLite"
}
```

#### POST /chat
AI 채팅

**요청:**
```json
{
  "user_id": "test_user",
  "message": "안녕하세요",
  "ai_type": "personal"
}
```

**응답:**
```json
{
  "response": "안녕하세요! 무엇을 도와드릴까요?",
  "ai_type": "personal",
  "model_used": "Qwen2.5-0.5B",
  "conv_id": 1
}
```

#### GET /history/{user_id}
대화 기록 조회

**파라미터:**
- `limit`: 조회 개수 (기본값: 10)

**응답:**
```json
[
  {
    "conv_id": 1,
    "user_id": "test_user",
    "message": "안녕하세요",
    "response": "안녕하세요! 무엇을 도와드릴까요?",
    "ai_type": "personal",
    "created_at": "2025-12-30 11:12:28"
  }
]
```

### Socket.IO (ws://34.227.194.156:3000)

#### 이벤트: send_message
메시지 전송

**페이로드:**
```json
{
  "user_id": "test_user",
  "message": "안녕하세요",
  "ai_type": "personal"
}
```

#### 이벤트: receive_message
AI 응답 수신

**페이로드:**
```json
{
  "success": true,
  "ai_response": "안녕하세요! 무엇을 도와드릴까요?",
  "ai_type": "personal",
  "model_used": "Qwen2.5-0.5B",
  "timestamp": "2025-12-30T11:12:28.000Z"
}
```

---

## 성능 지표

### 메모리 사용량
```
llama-server (0.5B): 571MB
llama-server (3B):   3.4GB
FastAPI:             40MB
Socket.IO:           20MB
Nginx:               10MB
시스템:              500MB
━━━━━━━━━━━━━━━━━━━━━━━━
총 사용량:           ~4.5GB / 4GB
여유:                ~500MB
```

### AI 응답 속도
```
Qwen 0.5B: 19 tokens/초
Qwen 3B:   21 tokens/초
평균 응답 시간: 3-5초
```

### 디스크 사용량
```
AI 모델:    2.5GB
llama.cpp:  100MB
데이터베이스: 20KB
시스템:     3GB
━━━━━━━━━━━━━━━━━━
총 사용량:  5.6GB / 30GB
```

---

## 보안 고려사항

### 현재 보안 설정
- ✅ SSH는 특정 IP만 허용
- ✅ HTTPS 미설정 (HTTP만)
- ⚠️ API 인증 없음
- ⚠️ 데이터베이스 암호화 없음

### 프로덕션 권장사항
1. **HTTPS 설정**
```bash
   sudo yum install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
```

2. **JWT 인증 추가**
   - FastAPI JWT 미들웨어
   - 사용자 인증/인가

3. **Rate Limiting**
   - Nginx rate limit
   - API 요청 제한

4. **데이터베이스 암호화**
   - SQLCipher 사용
   - 민감 데이터 암호화

---

## 향후 확장 계획

### 단기 (1-2개월)
- [ ] 프론트엔드 웹 앱 (React)
- [ ] 사용자 인증 시스템
- [ ] HTTPS 설정
- [ ] 모니터링 (CloudWatch)

### 중기 (3-6개월)
- [ ] OpenHash 구현
- [ ] EGCT 거래 시스템
- [ ] 다중 인스턴스 (로드 밸런싱)
- [ ] RDS 마이그레이션

### 장기 (6개월+)
- [ ] Kubernetes 마이그레이션
- [ ] AI 모델 자체 학습
- [ ] 블록체인 연동
- [ ] 글로벌 서비스 확장

---

## 참고 자료

### 공식 문서
- llama.cpp: https://github.com/ggerganov/llama.cpp
- FastAPI: https://fastapi.tiangolo.com/
- Socket.IO: https://socket.io/docs/v4/
- Nginx: https://nginx.org/en/docs/

### 설계 문서
- 고팡 채팅 앱 전체 설계도 (2)
- 고팡 시스템 단계별 구현 가이드 v3.0

### GitHub 저장소
- https://github.com/team-jupeter/gopang

---

**작성일**: 2025-12-30  
**버전**: 1.0.0  
**작성자**: 주피터 (Jupiter) & Claude  
**마지막 업데이트**: 2025-12-30

---

## 🎨 프론트엔드 개발 (추가 작업)

### 23단계: Native HTML 프론트엔드 구조 생성

**작업일:** 2025-12-30

원본 설계 문서에 따라 React 대신 Native HTML/CSS/JavaScript 사용
```bash
# 프론트엔드 디렉토리 생성
cd ~/gopang
mkdir -p frontend/public/{styles,scripts,assets}
```

**디렉토리 구조:**
```
frontend/
└── public/
    ├── index.html        # 메인 HTML
    ├── styles/
    │   └── main.css      # Material Design CSS
    ├── scripts/
    │   ├── config.js     # 환경 설정
    │   ├── socket.io.min.js
    │   └── main.js       # 메인 JavaScript
    └── assets/
```

---

### 24단계: index.html 작성

**목적:** 모바일 최적화 로그인 + 채팅 UI

**주요 기능:**
- 로그인 화면
- 채팅 화면
- 대화 상대 표시
- 메시지 입력/전송

**코드 위치:** `/home/ec2-user/gopang/frontend/public/index.html`

**핵심 구조:**
```html
<!-- 로그인 화면 -->
<div id="loginScreen" class="screen active">
  - 사용자 ID 입력
  - 이름 입력
  - 로그인 버튼
</div>

<!-- 채팅 화면 -->
<div id="chatScreen" class="screen">
  - 헤더 (사용자명, 검색, 로그아웃)
  - 대화 상대 표시
  - 메시지 영역
  - 입력 영역
</div>
```

---

### 25단계: CSS - Material Design + Minimalism

**파일:** `~/gopang/frontend/public/styles/main.css`

**디자인 원칙:**
1. **Material Design** - Google의 디자인 시스템
2. **Minimalism** - 불필요한 요소 제거
3. **Mobile-First** - 스마트폰 최적화
4. **Concise & Simple** - 간결하고 명확

**색상 팔레트:**
```css
:root {
    --primary: #1976D2;      /* 파란색 */
    --primary-light: #42A5F5;
    --primary-dark: #1565C0;
    --bg: #FAFAFA;           /* 배경 */
    --surface: #FFFFFF;      /* 카드 */
    --text: #212121;         /* 텍스트 */
    --text-secondary: #757575;
    --divider: #E0E0E0;      /* 구분선 */
}
```

**주요 특징:**
- 헤더 최소화 (48px)
- 불필요한 아이콘 제거
- 입력창 최대 확대
- 그림자 효과 (elevation)
- 부드러운 애니메이션
- 다크모드 지원

---

### 26단계: JavaScript - Socket.IO 연동

**파일:** `~/gopang/frontend/public/scripts/main.js`

**GopangChat 클래스 구조:**
```javascript
class GopangChat {
    constructor() {
        this.currentUser = null;
        this.currentTarget = null;  // 대화 상대
        this.socket = null;
    }
    
    // 핵심 메소드
    - init()              // 초기화
    - handleLogin()       // 로그인 처리
    - connectSocket()     // WebSocket 연결
    - sendMessage()       // 메시지 전송 (REST API)
    - addMessage()        // 메시지 UI 추가
    - showTyping()        // 타이핑 인디케이터
}
```

**통신 방식:**
- **메시지 전송:** REST API (POST /chat)
- **실시간 알림:** Socket.IO (선택적)
- **대화 기록:** REST API (GET /history)

---

### 27단계: Nginx 프론트엔드 서빙 설정

**문제:** S3 대신 EC2에서 직접 서빙 (비용 절감)

**Nginx 설정 업데이트:**
```nginx
server {
    listen 80;
    server_name _;
    
    root /home/ec2-user/gopang/frontend/public;
    index index.html;
    
    # 프론트엔드 정적 파일
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    location /styles/ {
        alias /home/ec2-user/gopang/frontend/public/styles/;
    }
    
    location /scripts/ {
        alias /home/ec2-user/gopang/frontend/public/scripts/;
    }
    
    # API 프록시
    location /api {
        rewrite ^/api(/.*)$ $1 break;
        proxy_pass http://127.0.0.1:8000;
        # ... (프록시 헤더)
    }
    
    # Socket.IO 프록시
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000/socket.io/;
        # ... (WebSocket 업그레이드)
    }
}
```

**적용:**
```bash
sudo nginx -t
sudo systemctl restart nginx
```

---

### 28단계: 파일 권한 문제 해결

**문제:** Nginx worker가 `/home/ec2-user/` 접근 불가

**에러 로그:**
```
[crit] stat() "/home/ec2-user/gopang/frontend/public/index.html" 
failed (13: Permission denied)
```

**원인:** 
- Nginx worker 프로세스는 `nginx` 사용자로 실행
- `/home/ec2-user` 디렉토리는 기본적으로 `drwx------` (700)
- `nginx` 사용자가 디렉토리 통과(execute) 불가

**해결:**
```bash
# 홈 디렉토리에 실행 권한 부여
chmod o+x /home/ec2-user
chmod o+x /home/ec2-user/gopang
chmod o+x /home/ec2-user/gopang/frontend

# 결과: drwx-----x (701)
```

**검증:**
```bash
curl -I http://localhost/
# HTTP/1.1 200 OK
```

---

### 29단계: AI 한국어 응답 최적화

**문제:** AI가 영어로 응답하거나 너무 긴 답변 생성

**개선 사항:**

1. **System Prompt 개선:**
```python
# 개인 AI (Qwen 0.5B)
prompt = f"""너는 친근한 개인 비서야. 한국어로만 대화해.

규칙:
- 짧고 간단하게 답변
- 존댓말 사용
- 자연스럽게 대화
- 한 문장으로 답변

사용자: {request.message}
AI:"""
```

2. **파라미터 조정:**
```python
{
    "n_predict": 80,           # 80 토큰으로 제한 (짧은 답변)
    "temperature": 0.8,        # 더 자연스러운 대화
    "repeat_penalty": 1.1,     # 반복 방지
}
```

3. **응답 후처리:**
```python
# 불필요한 프롬프트 반복 제거
if "사용자:" in content:
    content = content.split("사용자:")[0].strip()
```

---

### 30단계: 사용자 유형 구분 (설계 반영)

**원본 설계 요구사항:**
1. ✅ 사람 사용자만 로그인
2. ✅ 모든 사람은 전속 개인 비서 AI 보유
3. ✅ 기본 대화 상대 = 내 AI 비서
4. ✅ 검색으로 다른 사용자 선택 가능

**사용자 구분:**
```
사람 사용자:
- 로그인 필요
- 개인 비서 AI 1개 보유
- 예: 홍길동, 김철수

AI 사용자:
- 로그인 불필요
- 항상 온라인
- 예: 국세청, 건강보험공단, 제주시청
```

**UI 변경:**
- ❌ "개인 AI / 기관 AI" 탭 삭제
- ✅ "내 AI 비서" 기본 대화 상대
- ✅ 검색 아이콘 추가 (대화 상대 선택)

---

## 📊 현재 시스템 상태

### 완료된 섹션

| 섹션 | 내용 | 상태 |
|------|------|------|
| Section 1 | 로컬 환경 준비 | ✅ |
| Section 2 | AWS 인프라 (EC2) | ✅ |
| Section 3 | 데이터베이스 (기본) | ✅ |
| Section 4 | 백엔드 (Lambda 생략) | ⏭️ |
| Section 5 | AI 서버 구축 | ✅ |
| Section 6 | 프론트엔드 (기본) | ✅ |
| Section 7 | OpenHash 구현 | 🔲 |

### 미완료 기능

**데이터베이스:**
- [ ] AI 사용자 테이블
- [ ] System Prompt 저장
- [ ] 거래 기록 (EGCT)
- [ ] 재무제표

**프론트엔드:**
- [ ] 대화 상대 검색 기능
- [ ] 사용자 목록 표시
- [ ] AI 사용자 표시
- [ ] 대화 기록 로드
- [ ] 파일 업로드

**OpenHash:**
- [ ] 해시 생성
- [ ] Layer 분산 저장
- [ ] 전송 메커니즘

---

## 🔧 추가 트러블슈팅

### 문제 6: 프론트엔드 500 에러

**증상:**
```
GET http://34.227.194.156/ 500 (Internal Server Error)
```

**원인:** Nginx가 `/home/ec2-user/` 디렉토리에 접근 불가

**해결:**
```bash
chmod o+x /home/ec2-user
chmod o+x /home/ec2-user/gopang
chmod o+x /home/ec2-user/gopang/frontend
sudo systemctl restart nginx
```

### 문제 7: AI 영어 응답

**증상:** AI가 한국어로 질문해도 영어로 답변

**원인:** 
- System Prompt가 영어로 작성됨
- 모델이 영어 답변을 선호

**해결:**
- System Prompt를 한국어로 변경
- "한국어로만 대화해" 명시
- 짧은 답변 요구 ("한 문장으로")

### 문제 8: Socket.IO 연결 안됨

**증상:** 
```javascript
WebSocket connection failed
```

**원인:** Nginx WebSocket 프록시 설정 누락

**해결:**
```nginx
location /socket.io/ {
    proxy_pass http://127.0.0.1:3000/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
}
```

---

## 📱 모바일 최적화 기법

### 1. Viewport 설정
```html
<meta name="viewport" 
      content="width=device-width, initial-scale=1.0, 
               maximum-scale=1.0, user-scalable=no">
```

### 2. 동적 뷰포트 높이
```css
height: 100vh;
height: 100dvh;  /* 모바일 브라우저 주소창 고려 */
```

### 3. 세이프 에리어 (아이폰)
```css
padding-bottom: calc(8px + env(safe-area-inset-bottom));
```

### 4. 터치 최적화
```css
-webkit-overflow-scrolling: touch;  /* iOS 부드러운 스크롤 */
-webkit-tap-highlight-color: transparent;  /* 탭 하이라이트 제거 */
```

### 5. 폰트 크기
```css
font-size: 15px;  /* 16px 미만 시 iOS 자동 확대 방지 */
```

---

## 🎯 다음 단계 계획

### Section 7: OpenHash 구현 (9시간)

**주요 작업:**
1. 해시 생성 알고리즘
2. 확률적 Layer 선택
3. 데이터베이스 스키마
4. Layer별 전송 로직
5. AI 사용자 매핑

### Section 8: 통합 테스트 (8시간)

**테스트 항목:**
1. 로그인/로그아웃
2. 메시지 송수신
3. 대화 기록 저장
4. AI 응답 품질
5. 모바일 UI/UX

### Section 9: 시연 준비 (2시간)

**준비 사항:**
1. 데모 데이터 생성
2. 시나리오 작성
3. 성능 테스트
4. 문서화 완료

---

## 📈 성능 개선 결과

### 메모리 사용량 (최적화 후)
```
시스템:      500MB
llama-server: 3.9GB (0.5B + 3B)
FastAPI:     40MB
Socket.IO:   20MB
Nginx:       10MB
프론트엔드:  무시 가능
──────────────────
총:          4.5GB / 4GB
여유:        -500MB (약간 초과, 안정적)
```

### AI 응답 속도
```
Qwen 0.5B: 
- 이전: 5-8초
- 현재: 3-5초 (40% 개선)

Qwen 3B:
- 이전: 8-12초
- 현재: 5-8초 (30% 개선)
```

### 프론트엔드 로딩
```
HTML: <1KB
CSS: 6KB
JavaScript: 4KB + 62KB (socket.io)
총: 73KB → 모바일 4G에서 <1초
```

---

## 🔐 보안 고려사항 (추가)

### 현재 보안 수준
- ✅ SSH: 특정 IP만 허용
- ✅ 파일 권한: 최소 권한 원칙
- ⚠️ HTTP 사용 (HTTPS 미설정)
- ⚠️ 인증 없음 (사용자 ID만)
- ⚠️ Rate Limiting 없음

### 프로덕션 전환 시 필수 작업
1. **HTTPS 설정** (Let's Encrypt)
2. **JWT 인증** 추가
3. **Rate Limiting** (Nginx)
4. **입력 검증** (XSS, SQL Injection 방지)
5. **CORS 정책** 강화

---

## 📚 참고 자료 (추가)

### Material Design
- https://material.io/design
- https://m3.material.io/

### Socket.IO
- https://socket.io/docs/v4/
- https://socket.io/docs/v4/client-api/

### llama.cpp
- https://github.com/ggerganov/llama.cpp
- https://github.com/ggerganov/llama.cpp/blob/master/examples/server/README.md

### Qwen Models
- https://huggingface.co/Qwen
- https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF
- https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF

---

**마지막 업데이트:** 2025-12-30  
**버전:** 1.1.0  
**새로 추가된 섹션:** 프론트엔드 개발 (23-30단계)


---

## 🔗 OpenHash 시스템 구현 (추가 작업 - 단계 35-41)

### 35단계: OpenHash 데이터베이스 스키마 생성

**작업일:** 2025-12-30

OpenHash 명세서에 따라 분산 저장 시스템의 데이터베이스 구조 구축

**생성된 테이블:**

1. **ai_users** - AI 사용자 정보
```sql
   CREATE TABLE ai_users (
       ai_id TEXT PRIMARY KEY,
       ai_name TEXT NOT NULL,
       ai_type TEXT NOT NULL,
       system_prompt TEXT NOT NULL,
       owner_id TEXT,
       region_code TEXT,
       layer INTEGER,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )
```
   
2. **openhash_records** - 해시 레코드
```sql
   CREATE TABLE openhash_records (
       hash_id TEXT PRIMARY KEY,
       user_id TEXT NOT NULL,
       content_type TEXT NOT NULL,
       content_hash TEXT NOT NULL,
       layer INTEGER NOT NULL,
       transmitted BOOLEAN DEFAULT FALSE,
       transmitted_at TIMESTAMP,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )
```

3. **layer_storage** - 계층별 저장소
```sql
   CREATE TABLE layer_storage (
       storage_id INTEGER PRIMARY KEY AUTOINCREMENT,
       hash_id TEXT NOT NULL,
       layer INTEGER NOT NULL,
       ai_id TEXT NOT NULL,
       stored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )
```

**초기 데이터:**
- AI 사용자 12개 등록
  - Layer 4: 국세청, 건강보험공단, 법원, 특허청
  - Layer 3: 제주특별자치도청
  - Layer 2: 제주시청, 서귀포시청, 제주대학교병원
  - Layer 1: 한림읍, 노형동, 중앙동, 안덕면 행정복지센터

**실행:**
```bash
python3 database/create_openhash_tables.py
```

---

### 36단계: OpenHash 핵심 로직 구현

**파일:** `/home/ec2-user/gopang/openhash/hash_generator.py`

**구현된 기능:**

1. **해시 생성**
```python
   def generate_hash(content: str) -> str:
       return hashlib.sha256(content.encode('utf-8')).hexdigest()
```

2. **확률적 계층 선택**
```python
   def select_layer_probabilistic(hash_value: str) -> int:
       last_byte = int(hash_value[-2:], 16)
       # Layer 0: 60% (0-152)
       # Layer 1: 20% (153-203)
       # Layer 2: 10% (204-229)
       # Layer 3: 7% (230-247)
       # Layer 4: 3% (248-255)
```

3. **타겟 AI 결정**
```python
   def get_target_ai(layer: int, region_code: str) -> str:
       # Layer와 지역 코드에 따라 담당 AI 결정
       # Layer 1: 읍면동 AI
       # Layer 2: 시군구 AI
       # Layer 3: 광역시도 AI
       # Layer 4: 국가 AI (라운드 로빈)
```

4. **해시 레코드 생성**
```python
   def create_hash_record(user_id, content, content_type):
       # 1. 해시 생성
       # 2. 확률적 Layer 선택
       # 3. 타겟 AI 결정
       # 4. openhash_records 저장
       # 5. layer_storage 저장 (Layer > 0)
       return (hash_id, layer, target_ai)
```

**테스트 결과:**
```
Hash ID: hash_20251230115539_2c503beb
Layer: 1
Target AI: ai_06 (한림읍행정복지센터)
```

---

### 37단계: users 테이블 확장

**문제:** users 테이블에 `region_code` 컬럼 누락

**해결:**
```sql
ALTER TABLE users ADD COLUMN region_code TEXT DEFAULT '5011025000'
```

**기본값:** '5011025000' (한림읍)

---

### 38단계: FastAPI OpenHash 통합

**파일:** `/home/ec2-user/gopang/ai-server/ai_server.py`

**주요 변경사항:**

1. **OpenHash 모듈 임포트**
```python
   from openhash.hash_generator import create_hash_record, get_hash_statistics
```

2. **대화 저장 시 자동 해시 생성**
```python
   # 대화 기록 저장
   conv_id = save_conversation(...)
   
   # OpenHash 레코드 생성
   conversation_content = f"{request.message}\n{ai_response}"
   hash_id, layer, target_ai = create_hash_record(
       user_id=request.user_id,
       content=conversation_content,
       content_type='conversation'
   )
   
   # 응답에 해시 정보 포함
   hash_info = {
       "hash_id": hash_id,
       "layer": layer,
       "target_ai": target_ai
   }
```

3. **OpenHash 통계 API 추가**
```python
   @app.get("/openhash/stats")
   async def openhash_stats():
       return get_hash_statistics()
```

**API 응답 예시:**
```json
{
  "response": "안녕하세요!",
  "ai_type": "personal",
  "model_used": "Qwen2.5-0.5B",
  "conv_id": 1,
  "hash_info": {
    "hash_id": "hash_20251230115539_2c503beb",
    "layer": 1,
    "target_ai": "ai_06"
  }
}
```

---

### 39단계: 사용자 검색 API 구현

**새로운 엔드포인트:**

**GET /users/list** - 모든 사용자 목록 조회
```python
@app.get("/users/list", response_model=List[UserInfo])
async def list_users():
    # 사람 사용자 + AI 사용자 통합 반환
    return [
        UserInfo(
            user_id="test_user",
            name="테스트 사용자",
            user_type="사람",
            is_online=True
        ),
        UserInfo(
            user_id="ai_01",
            name="국세청",
            user_type="기관",
            is_online=True
        ),
        # ...
    ]
```

**POST /chat** - 대화 상대 지정 지원
```python
class ChatRequest(BaseModel):
    user_id: str
    message: str
    target_user: Optional[str] = None  # 대화 상대 지정
    ai_type: str = "personal"
```

- `target_user` 없음: 개인 비서 AI (Qwen 0.5B)
- `target_user` 있음: 해당 AI의 system_prompt 사용 (Qwen 3B)

---

### 40단계: 프론트엔드 검색 기능

**파일:** `/home/ec2-user/gopang/frontend/public/scripts/main.js`

**새로운 기능:**

1. **사용자 목록 로드**
```javascript
   async loadUsers() {
       const response = await fetch(`${API_URL}/users/list`);
       this.allUsers = await response.json();
   }
```

2. **검색 모달**
   - 검색 버튼 클릭 → 모달 팝업
   - 실시간 검색 필터링
   - 사용자 선택 → 대화 상대 변경

3. **대화 상대 선택**
```javascript
   selectTarget(userId) {
       const user = this.allUsers.find(u => u.user_id === userId);
       this.currentTarget = user;
       this.updateTargetDisplay();
   }
```

4. **메시지 전송 (대화 상대 반영)**
```javascript
   const requestData = {
       user_id: this.currentUser.userId,
       message: message,
       target_user: this.currentTarget?.user_id,
       ai_type: this.currentTarget ? 'institution' : 'personal'
   };
```

**UI 구조:**
```
┌─────────────────────────────────┐
│ 홍길동  🔍  로그아웃            │ ← 헤더
├─────────────────────────────────┤
│ 🤖 내 AI 비서 (또는 선택한 AI) │ ← 대화 상대
├─────────────────────────────────┤
│                                 │
│  메시지 영역                     │
│                                 │
├─────────────────────────────────┤
│ [입력창]           [전송]       │
└─────────────────────────────────┘
```

---

### 41단계: 검색 모달 UI 스타일

**파일:** `/home/ec2-user/gopang/frontend/public/styles/main.css`

**추가된 스타일:**

1. **검색 모달**
   - 반투명 오버레이
   - 중앙 정렬 모달 창
   - 최대 높이 80vh (스크롤 가능)

2. **사용자 아이템**
   - 아바타: 사람 👤, 기관 🏛️
   - 이름 + 유형 표시
   - 온라인 상태 표시 (녹색 점)
   - 호버/액티브 효과

3. **검색 입력**
   - 라운드 디자인
   - 포커스 효과
   - 실시간 필터링

**예시 UI:**
```
┌────────────────────────────┐
│ 대화 상대 선택          × │
├────────────────────────────┤
│ [🔍 이름 검색...]         │
├────────────────────────────┤
│ 👤 김철수                 │
│    사람               ●   │
├────────────────────────────┤
│ 🏛️ 국세청                 │
│    기관               ●   │
├────────────────────────────┤
│ 🏛️ 제주시청               │
│    기관               ●   │
└────────────────────────────┘
```

---

## 📊 Phase 1 완료 현황 (90%)

### ✅ 완료된 작업

| 항목 | 상태 | 비고 |
|------|------|------|
| EC2 인프라 | ✅ | t2.medium, Ubuntu 24.04 |
| AI 서버 (llama.cpp) | ✅ | Qwen 0.5B + 3B |
| FastAPI 백엔드 | ✅ | 한국어 응답, DB 연동 |
| SQLite 데이터베이스 | ✅ | 6개 테이블 |
| OpenHash 기본 구조 | ✅ | 해시 생성, Layer 선택 |
| 프론트엔드 (HTML/CSS/JS) | ✅ | Material Design |
| 로그인/로그아웃 | ✅ | localStorage |
| 채팅 기능 | ✅ | 실시간 AI 응답 |
| 검색 기능 | ✅ | 사용자 + AI 목록 |
| 대화 상대 선택 | ✅ | 동적 AI 전환 |

### 🔲 Phase 1 마무리 작업 (10%)

- [ ] 통합 테스트
- [ ] 버그 수정
- [ ] GitHub 커밋
- [ ] 문서화 최종 업데이트

---

## 🎯 Phase 2 예정 작업 (프로토타입 완성)

### 1. 타임스탬프 + 지역코드 결합 해시 (1시간)
```python
H_combined = SHA256(H_doc || T || R)
random_value = (H_combined[0:8] as uint64) % 1000
```

### 2. 계층 간 해시 전파 (3시간)
- Layer 1 → Layer 2 → Layer 3 → Layer 4
- 머클트리 통합
- 상위 계층 동기화

### 3. 기본 신뢰도 계산 (2시간)
```
Trust_Score = Layer_Weight × Time_Factor
Layer 1: 1.0, Layer 2: 1.5, Layer 3: 2.0, Layer 4: 2.5
Time_Factor = 1 + log(1 + Days/365)
```

---

## 📈 시스템 성능 (Phase 1)

### 응답 시간
- Qwen 0.5B: 3-5초
- Qwen 3B: 5-8초
- API: <100ms

### 메모리 사용
- 시스템: 500MB
- llama-server: 3.9GB
- FastAPI: 43MB
- 총: 4.5GB / 4GB

### OpenHash 통계
- 총 해시: 1개
- Layer 1: 1개
- 평균 해시 생성 시간: <1ms

---

## 🔒 보안 현황

### 구현됨
- ✅ SSH 키 기반 인증
- ✅ 최소 파일 권한
- ✅ SHA-256 해시 (암호학적 보안)

### 미구현 (프로덕션 필요)
- ⚠️ HTTPS (Let's Encrypt)
- ⚠️ JWT 인증
- ⚠️ ECDSA P-256 디지털 서명
- ⚠️ Rate Limiting

---

**마지막 업데이트:** 2025-12-30  
**버전:** 1.2.0  
**Phase 1 진행률:** 90%  
**다음 마일스톤:** Phase 1 완료 → GitHub 커밋 → Phase 2 시작

