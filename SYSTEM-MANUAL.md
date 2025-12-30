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
