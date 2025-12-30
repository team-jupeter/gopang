#!/bin/bash
echo "=== FastAPI AI Server Logs ==="
sudo journalctl -u gopang-ai -n 50 --no-pager
echo ""
echo "=== Socket.IO Server Logs ==="
sudo journalctl -u gopang-socket -n 50 --no-pager
echo ""
echo "=== Nginx Logs ==="
sudo tail -n 30 /var/log/nginx/error.log
