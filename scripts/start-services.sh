#!/bin/bash
echo "🚀 Gopang 서비스 시작..."
sudo systemctl start gopang-ai
sudo systemctl start gopang-socket
sudo systemctl start nginx
sleep 2
sudo systemctl status gopang-ai --no-pager
sudo systemctl status gopang-socket --no-pager
sudo systemctl status nginx --no-pager
