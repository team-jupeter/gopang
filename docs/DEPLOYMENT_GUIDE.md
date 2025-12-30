# 🚀 Gopang 배포 가이드

**버전**: 3.2.0  
**대상**: 프로덕션 환경 배포

---

## 📋 목차

1. [서버 요구사항](#서버-요구사항)
2. [보안 설정](#보안-설정)
3. [프로덕션 배포](#프로덕션-배포)
4. [모니터링](#모니터링)
5. [백업 전략](#백업-전략)
6. [스케일링](#스케일링)
7. [트러블슈팅](#트러블슈팅)

---

## 💻 서버 요구사항

### 최소 사양 (개발/테스트)
```yaml
OS: Ubuntu 22.04+ / Amazon Linux 2023
CPU: 2 vCPU
RAM: 4GB
Storage: 20GB SSD
Network: 100 Mbps
```

### 권장 사양 (프로덕션)
```yaml
OS: Ubuntu 22.04 LTS
CPU: 4 vCPU (8+ for high traffic)
RAM: 8GB (16GB+ recommended)
Storage: 100GB SSD (NVMe preferred)
Network: 1 Gbps
```

### 대규모 배포
```yaml
OS: Ubuntu 22.04 LTS
CPU: 16+ vCPU
RAM: 32GB+
Storage: 500GB NVMe SSD
Network: 10 Gbps
Load Balancer: Yes
Replica: 3+ instances
```

---

## 🔒 보안 설정

### 1. 방화벽 설정 (UFW)
```bash
# UFW 설치
sudo apt install ufw

# 기본 정책
sudo ufw default deny incoming
sudo ufw default allow outgoing

# 필수 포트 허용
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS

# UFW 활성화
sudo ufw enable
sudo ufw status
```

### 2. HTTPS 설정 (Let's Encrypt)
```bash
# Certbot 설치
sudo apt install certbot python3-certbot-nginx

# 인증서 발급
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 자동 갱신 설정
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer

# 갱신 테스트
sudo certbot renew --dry-run
```

**Nginx SSL 설정** (`/etc/nginx/conf.d/gopang-ssl.conf`):
```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL 보안 설정
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256';
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # 보안 헤더
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        root /home/ec2-user/gopang/frontend/public;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:3000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}

# HTTP → HTTPS 리다이렉트
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}
```

### 3. SSH 보안 강화
```bash
# SSH 설정 파일 편집
sudo nano /etc/ssh/sshd_config
```

**권장 설정**:
```
Port 22
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
MaxAuthTries 3
ClientAliveInterval 300
ClientAliveCountMax 2
```
```bash
# SSH 재시작
sudo systemctl restart sshd
```

### 4. Fail2ban 설치
```bash
# 설치
sudo apt install fail2ban

# 설정
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo nano /etc/fail2ban/jail.local
```

**jail.local 설정**:
```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true

[nginx-http-auth]
enabled = true

[nginx-botsearch]
enabled = true
```
```bash
# 시작
sudo systemctl enable fail2ban
sudo systemctl start fail2ban

# 상태 확인
sudo fail2ban-client status
```

### 5. 데이터베이스 보안
```bash
# SQLite 파일 권한
chmod 640 ~/gopang/database/gopang.db
chown ec2-user:ec2-user ~/gopang/database/gopang.db

# 키 파일 권한
chmod 600 ~/gopang/keys/*_private.pem
chmod 644 ~/gopang/keys/*_public.pem
```

---

## 🎯 프로덕션 배포

### 1. 환경 변수 설정
```bash
# 환경 변수 파일 생성
cat > ~/gopang/.env << 'ENVEOF'
# 서버 설정
HOST=0.0.0.0
PORT=8000
WORKERS=4

# 데이터베이스
DB_PATH=/home/ec2-user/gopang/database/gopang.db

# AI 모델
LLAMA_0_5B_URL=http://127.0.0.1:8001
LLAMA_3B_URL=http://127.0.0.1:8002

# 보안
SECRET_KEY=your-secret-key-here-change-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRATION=3600

# 로깅
LOG_LEVEL=INFO
LOG_FILE=/var/log/gopang/app.log
ENVEOF

# 파일 권한
chmod 600 ~/gopang/.env
```

### 2. systemd 서비스 업데이트 (프로덕션)

**gopang-ai.service** (멀티 워커):
```ini
[Unit]
Description=Gopang FastAPI AI Server (Production)
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/home/ec2-user/gopang/ai-server
Environment="PATH=/home/ec2-user/gopang/venv/bin"
EnvironmentFile=/home/ec2-user/gopang/.env
ExecStart=/home/ec2-user/gopang/venv/bin/uvicorn ai_server:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 4 \
    --log-level info \
    --access-log \
    --proxy-headers
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### 3. 로그 설정
```bash
# 로그 디렉토리 생성
sudo mkdir -p /var/log/gopang
sudo chown ec2-user:ec2-user /var/log/gopang

# logrotate 설정
sudo cat > /etc/logrotate.d/gopang << 'LOGEOF'
/var/log/gopang/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 ec2-user ec2-user
    sharedscripts
    postrotate
        systemctl reload gopang-ai > /dev/null 2>&1 || true
    endscript
}
LOGEOF
```

### 4. 배포 체크리스트

**배포 전:**
- [ ] 서버 사양 확인
- [ ] DNS 설정 완료
- [ ] SSL 인증서 발급
- [ ] 환경 변수 설정
- [ ] 방화벽 규칙 설정
- [ ] 백업 시스템 구축

**배포:**
- [ ] 코드 최신화 (`git pull`)
- [ ] 의존성 설치 (`pip install -r requirements.txt`)
- [ ] 데이터베이스 마이그레이션
- [ ] systemd 서비스 업데이트
- [ ] Nginx 설정 업데이트
- [ ] 서비스 재시작

**배포 후:**
- [ ] 헬스 체크 (`curl https://your-domain.com/health`)
- [ ] API 테스트
- [ ] 로그 확인
- [ ] 모니터링 대시보드 확인
- [ ] 백업 검증

---

## 📊 모니터링

### 1. Prometheus + Grafana

**Prometheus 설치**:
```bash
# Prometheus 다운로드
wget https://github.com/prometheus/prometheus/releases/download/v2.48.0/prometheus-2.48.0.linux-amd64.tar.gz
tar xvfz prometheus-2.48.0.linux-amd64.tar.gz
cd prometheus-2.48.0.linux-amd64

# 설정 파일
cat > prometheus.yml << 'PROMEOF'
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'gopang'
    static_configs:
      - targets: ['localhost:8000']
PROMEOF

# 실행
./prometheus --config.file=prometheus.yml
```

**Grafana 설치**:
```bash
# Grafana APT 저장소 추가
sudo apt-get install -y software-properties-common
sudo add-apt-repository "deb https://packages.grafana.com/oss/deb stable main"
wget -q -O - https://packages.grafana.com/gpg.key | sudo apt-key add -
sudo apt-get update
sudo apt-get install grafana

# 시작
sudo systemctl enable grafana-server
sudo systemctl start grafana-server

# 접속: http://localhost:3000
# 기본 계정: admin/admin
```

### 2. 시스템 메트릭

**주요 모니터링 지표**:
```yaml
CPU:
  - 사용률 (< 70%)
  - 로드 평균 (< 코어 수)

메모리:
  - 사용률 (< 80%)
  - 스왑 사용 (< 10%)

디스크:
  - 사용률 (< 80%)
  - I/O 대기 (< 10%)

네트워크:
  - 대역폭 사용률
  - 패킷 손실률 (< 1%)

애플리케이션:
  - 응답 시간 (< 100ms)
  - 에러율 (< 0.1%)
  - 활성 연결 수
```

### 3. 로그 모니터링
```bash
# 실시간 로그 확인
tail -f /var/log/gopang/app.log

# 에러 로그 필터
grep ERROR /var/log/gopang/app.log

# 최근 1시간 에러
journalctl -u gopang-ai --since "1 hour ago" | grep ERROR
```

---

## 💾 백업 전략

### 1. 데이터베이스 백업

**자동 백업 스크립트**:
```bash
cat > ~/gopang/scripts/backup_db.sh << 'BACKUPEOF'
#!/bin/bash

BACKUP_DIR="/backup/gopang"
DB_PATH="/home/ec2-user/gopang/database/gopang.db"
DATE=$(date +%Y%m%d_%H%M%S)

# 백업 디렉토리 생성
mkdir -p $BACKUP_DIR

# SQLite 백업
sqlite3 $DB_PATH ".backup $BACKUP_DIR/gopang_$DATE.db"

# 압축
gzip $BACKUP_DIR/gopang_$DATE.db

# 7일 이상 오래된 백업 삭제
find $BACKUP_DIR -name "gopang_*.db.gz" -mtime +7 -delete

echo "Backup completed: gopang_$DATE.db.gz"
BACKUPEOF

chmod +x ~/gopang/scripts/backup_db.sh
```

**cron 등록** (매일 새벽 2시):
```bash
crontab -e

# 추가
0 2 * * * /home/ec2-user/gopang/scripts/backup_db.sh >> /var/log/gopang/backup.log 2>&1
```

### 2. 키 파일 백업
```bash
# 키 백업
tar -czf keys_backup_$(date +%Y%m%d).tar.gz ~/gopang/keys

# 안전한 위치로 이동 (예: S3)
aws s3 cp keys_backup_*.tar.gz s3://your-bucket/gopang-backups/
```

### 3. 전체 시스템 백업
```bash
# 스냅샷 생성 (AWS EC2)
aws ec2 create-snapshot \
  --volume-id vol-1234567890abcdef0 \
  --description "Gopang backup $(date +%Y-%m-%d)"

# 스냅샷 목록
aws ec2 describe-snapshots --owner-ids self
```

---

## 📈 스케일링

### 1. 수직 스케일링 (Scale Up)

**CPU/RAM 증설**:
```bash
# AWS EC2 인스턴스 타입 변경
# t2.medium (2 vCPU, 4GB) → t2.xlarge (4 vCPU, 16GB)
aws ec2 modify-instance-attribute \
  --instance-id i-1234567890abcdef0 \
  --instance-type t2.xlarge
```

### 2. 수평 스케일링 (Scale Out)

**로드 밸런서 설정**:
```nginx
# Nginx 업스트림 설정
upstream gopang_backend {
    least_conn;
    server 10.0.1.10:8000 weight=1;
    server 10.0.1.11:8000 weight=1;
    server 10.0.1.12:8000 weight=1;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    location /api/ {
        proxy_pass http://gopang_backend/;
        proxy_next_upstream error timeout invalid_header http_500;
        proxy_connect_timeout 2s;
    }
}
```

**세션 공유** (Redis):
```bash
# Redis 설치
sudo apt install redis-server

# Python Redis 클라이언트
pip install redis
```

### 3. 데이터베이스 스케일링

**PostgreSQL 마이그레이션**:
```python
# SQLite → PostgreSQL
import sqlite3
import psycopg2

# SQLite 읽기
sqlite_conn = sqlite3.connect('gopang.db')
sqlite_cursor = sqlite_conn.cursor()

# PostgreSQL 쓰기
pg_conn = psycopg2.connect(
    host='localhost',
    database='gopang',
    user='gopang_user',
    password='password'
)
pg_cursor = pg_conn.cursor()

# 데이터 마이그레이션
for table in ['users', 'conversations', 'openhash_records', ...]:
    sqlite_cursor.execute(f"SELECT * FROM {table}")
    rows = sqlite_cursor.fetchall()
    
    for row in rows:
        pg_cursor.execute(f"INSERT INTO {table} VALUES (...)", row)

pg_conn.commit()
```

---

## 🔧 트러블슈팅

### 문제 1: 메모리 부족

**증상**:
```
OOMKilled: Out of memory
```

**해결**:
```bash
# 스왑 파일 생성 (4GB)
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# 영구 설정
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### 문제 2: AI 모델 로딩 실패

**증상**:
```
Failed to load model: No such file or directory
```

**해결**:
```bash
# 모델 경로 확인
ls -lh ~/models/*.gguf

# llama-server 로그 확인
journalctl -u gopang-llama-0.5b -n 50

# 모델 재다운로드
cd ~/models
wget https://huggingface.co/Qwen/...
```

### 문제 3: 높은 응답 시간

**증상**:
```
API response time > 10s
```

**해결**:
```bash
# 1. 워커 수 증가
# gopang-ai.service
--workers 8

# 2. 데이터베이스 인덱스 확인
sqlite3 gopang.db "PRAGMA index_list('openhash_records');"

# 3. Nginx 캐싱 활성화
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m;
proxy_cache api_cache;
proxy_cache_valid 200 5m;
```

### 문제 4: SSL 인증서 만료

**증상**:
```
SSL certificate expired
```

**해결**:
```bash
# 수동 갱신
sudo certbot renew

# 자동 갱신 테스트
sudo certbot renew --dry-run

# 타이머 확인
sudo systemctl status certbot.timer
```

---

## 📝 체크리스트

### 일일 점검
- [ ] 서비스 상태 확인 (`systemctl status gopang-*`)
- [ ] 에러 로그 확인
- [ ] 디스크 사용률 확인 (`df -h`)
- [ ] 메모리 사용률 확인 (`free -h`)

### 주간 점검
- [ ] 백업 검증
- [ ] SSL 인증서 만료일 확인
- [ ] 보안 업데이트 (`sudo apt update && sudo apt upgrade`)
- [ ] 로그 분석

### 월간 점검
- [ ] 성능 리포트 작성
- [ ] 용량 계획 검토
- [ ] 보안 감사
- [ ] 스케일링 필요성 평가

---

## 🆘 긴급 연락처

**개발팀**:
- GitHub Issues: https://github.com/team-jupeter/gopang/issues
- Email: (설정 필요)

**서버 관리**:
- 클라우드 제공자: AWS Support
- DNS: Cloudflare Support

---

**문서 버전**: 3.2.0  
**최종 업데이트**: 2025-12-30  
**작성자**: Team Jupeter
