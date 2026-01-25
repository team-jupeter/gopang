#!/bin/bash
# SQLite 데이터베이스 S3 자동 백업
# Day 8: 매일 자정 실행

DATE=$(date +%Y%m%d_%H%M%S)
DB_PATH="/gopang/data/db/gopang.db"
BACKUP_DIR="/gopang/data/backups"
S3_BUCKET="gopang-backups-193452400412"
REGION="us-east-1"

# 로컬 백업
mkdir -p $BACKUP_DIR
sqlite3 $DB_PATH ".backup '$BACKUP_DIR/gopang_$DATE.db'"

# S3 업로드
aws s3 cp "$BACKUP_DIR/gopang_$DATE.db" "s3://$S3_BUCKET/db/gopang_$DATE.db" --region $REGION

# 7일 이상 로컬 백업 삭제
find $BACKUP_DIR -name "gopang_*.db" -mtime +7 -delete

echo "[$(date)] Backup completed: gopang_$DATE.db"
