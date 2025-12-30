#!/bin/bash
echo "🛑 Gopang 서비스 중지..."
sudo systemctl stop gopang-ai
sudo systemctl stop gopang-socket
sudo systemctl stop nginx
echo "✅ 모든 서비스 중지 완료"
