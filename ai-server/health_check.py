"""
종합 헬스 체크
"""
import sqlite3
import requests
from datetime import datetime

DB_PATH = "/home/ec2-user/gopang/database/gopang.db"

def check_database():
    """데이터베이스 상태"""
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM openhash_records")
        count = cursor.fetchone()[0]
        conn.close()
        return {"status": "healthy", "records": count}
    except Exception as e:
        return {"status": "unhealthy", "error": str(e)}

def check_llama_servers():
    """AI 서버 상태"""
    servers = {
        "llama-0.5b": "http://127.0.0.1:8001/health",
        "llama-3b": "http://127.0.0.1:8002/health"
    }
    
    results = {}
    for name, url in servers.items():
        try:
            response = requests.get(url, timeout=2)
            results[name] = {
                "status": "healthy" if response.status_code == 200 else "unhealthy",
                "response_time": response.elapsed.total_seconds()
            }
        except:
            results[name] = {"status": "unhealthy"}
    
    return results

def comprehensive_health_check():
    """종합 헬스 체크"""
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "database": check_database(),
        "llama_servers": check_llama_servers(),
        "overall": "healthy"
    }
