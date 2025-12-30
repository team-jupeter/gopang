#!/bin/bash
echo "🔄 Gopang 서비스 재시작..."
sudo systemctl restart gopang-ai
sudo systemctl restart gopang-socket
sudo systemctl restart nginx
sleep 2
sudo systemctl status gopang-ai --no-pager
sudo systemctl status gopang-socket --no-pager
sudo systemctl status nginx --no-pager
