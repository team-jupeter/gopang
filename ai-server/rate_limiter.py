"""
Rate Limiting (API 요청 제한)
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# 제한 규칙
RATE_LIMITS = {
    "default": "100/minute",
    "chat": "20/minute",
    "openhash": "50/minute",
    "healing": "10/minute"
}
