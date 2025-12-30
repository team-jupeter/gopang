#!/bin/bash
echo "╔════════════════════════════════════════════════════════════╗"
echo "║  Gopang Health Check                                       ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# FastAPI 서버
echo -n "FastAPI (Port 8000): "
if curl -s http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

# Socket.IO 서버
echo -n "Socket.IO (Port 3000): "
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

# Nginx
echo -n "Nginx (Port 80): "
if curl -s http://localhost/health > /dev/null 2>&1; then
    echo "✅ Running"
else
    echo "❌ Not responding"
fi

echo ""
echo "=== System Resources ==="
free -h | grep Mem
df -h / | tail -1
echo ""
echo "=== Service Status ==="
systemctl is-active gopang-ai --quiet && echo "gopang-ai: ✅ active" || echo "gopang-ai: ❌ inactive"
systemctl is-active gopang-socket --quiet && echo "gopang-socket: ✅ active" || echo "gopang-socket: ❌ inactive"
systemctl is-active nginx --quiet && echo "nginx: ✅ active" || echo "nginx: ❌ inactive"
