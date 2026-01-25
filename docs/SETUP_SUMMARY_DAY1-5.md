# 고팡(Gopang) 인프라 구축 요약서

**작성일**: 2026년 1월 22일  
**Phase**: 1 (환경 설정 및 기반 구축)  
**진행**: Day 1 ~ Day 5 완료

---

## 인스턴스 정보

| 항목 | 값 |
|------|-----|
| Instance ID | i-01fd207940a6d0bd9 |
| Instance Type | t3.medium (2 vCPU, 4GB RAM) |
| AMI | Ubuntu 24.04 LTS (ami-0b6c6ebed2801a5cb) |
| Region | us-east-1 |
| Availability Zone | us-east-1f |
| Public IP | 98.92.156.117 |
| Private IP | 172.31.71.177 |
| Key Pair | gopang-dev-key |

---

## Day 1: EC2 초기 설정 ✅

| 항목 | 상태 | 비고 |
|------|------|------|
| 시스템 업데이트 | ✅ | apt update && upgrade |
| 타임존 | ✅ | Asia/Seoul (KST) |
| 호스트명 | ✅ | gopang-dev |
| 기본 도구 | ✅ | curl, wget, git, vim, htop, fail2ban, unzip, jq |
| AWS CLI | ✅ | v2.33.4 |
| 프로젝트 디렉토리 | ✅ | /gopang/{backend,frontend,ai-engine,logs,data,scripts,config} |
| SSH 포트 변경 | ✅ | 22 → 2222 |
| root 로그인 | ✅ | 비활성화 |
| fail2ban | ✅ | active (running) |

### SSH 접속 명령어
```
ssh -i "C:\Users\주피터\.ssh\gopang-dev-key.pem" -p 2222 ubuntu@98.92.156.117
```

---

## Day 2: 스왑 메모리 및 개발 환경 ✅

| 항목 | 상태 | 비고 |
|------|------|------|
| EBS 볼륨 확장 | ✅ | 8GB → 20GB |
| 스왑 파일 | ✅ | 8GB (/swapfile) |
| swappiness | ✅ | 10 |
| Node.js | ✅ | v20.20.0 LTS |
| npm | ✅ | v10.8.2 |
| Python | ✅ | v3.12.3 |
| Python venv | ✅ | /gopang/ai-engine/venv |
| pip | ✅ | v25.3 |
| 메모리 모니터링 | ✅ | cron 5분마다 실행 |

---

## Day 3: VPC 및 서브넷 구성 ✅

| 리소스 | ID | CIDR/값 |
|--------|-----|---------|
| VPC | vpc-0faf22a8d44758043 | 10.0.0.0/16 |
| 퍼블릭 서브넷 | subnet-0aacd934ca8c06a42 | 10.0.1.0/24 |
| 프라이빗 서브넷 | subnet-0032e70bae3889720 | 10.0.2.0/24 |
| 인터넷 게이트웨이 | igw-0825d183260e8ec76 | - |
| VPC Flow Logs | fl-0c196f03854fe9e36 | CloudWatch |

---

## Day 4: 보안 그룹 및 HTTPS 준비 ✅

| 보안 그룹 | ID | 용도 |
|----------|-----|------|
| gopang-ec2-sg | sg-0abce6935a3e7ce9c | EC2 (기본 VPC) |
| gopang-ec2-sg | sg-0af26c2f721e1076d | EC2 (신규 VPC) |
| gopang-efs-sg | sg-03292572406699f83 | EFS (신규 VPC) |
| gopang-efs-default-vpc | sg-05c81b752107d0aff | EFS (기본 VPC) |

### 열린 포트
- 2222: SSH
- 80: HTTP
- 443: HTTPS

### Nginx
- 버전: 1.24.0
- Health Check: http://98.92.156.117/health

### Certbot
- 버전: 2.9.0

---

## Day 5: EFS 생성, 마운트, 백업 설정 ✅

| 항목 | 값 |
|------|-----|
| File System ID | fs-00845a752af3da1a5 |
| 마운트 포인트 | /mnt/efs |
| 심볼릭 링크 | /gopang/data → /mnt/efs |
| 암호화 | ✅ 활성화 |
| Backup Vault | gopang-backup-vault |
| 백업 스케줄 | 매일 KST 02:00 (7일 보관) |

### EFS 디렉토리 구조
```
/gopang/data → /mnt/efs/
├── db/        # SQLite 데이터베이스
├── models/    # AI 모델 파일
├── backups/   # 수동 백업
└── uploads/   # 사용자 업로드
```

---

## 월 비용 예상: ~$34

---

**문서 끝**
