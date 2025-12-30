"""
구조화된 로깅 시스템
"""
import logging
import json
from datetime import datetime

class JSONFormatter(logging.Formatter):
    """JSON 형식 로그"""
    def format(self, record):
        log_data = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno
        }
        
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(log_data, ensure_ascii=False)

def setup_logging():
    """로깅 설정"""
    logger = logging.getLogger("gopang")
    logger.setLevel(logging.INFO)
    
    # 콘솔 핸들러
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(JSONFormatter())
    logger.addHandler(console_handler)
    
    # 파일 핸들러
    try:
        file_handler = logging.FileHandler("/var/log/gopang/app.log")
        file_handler.setFormatter(JSONFormatter())
        logger.addHandler(file_handler)
    except:
        pass  # 파일 로깅 실패 시 무시
    
    return logger

logger = setup_logging()
