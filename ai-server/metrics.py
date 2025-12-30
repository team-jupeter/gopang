"""
Prometheus 스타일 메트릭
"""
from collections import defaultdict
from datetime import datetime

class Metrics:
    """메트릭 수집기"""
    def __init__(self):
        self.request_count = defaultdict(int)
        self.response_times = defaultdict(list)
        self.error_count = defaultdict(int)
        self.start_time = datetime.utcnow()
    
    def record_request(self, endpoint: str, response_time: float, status_code: int):
        """요청 기록"""
        self.request_count[endpoint] += 1
        self.response_times[endpoint].append(response_time)
        
        if status_code >= 400:
            self.error_count[endpoint] += 1
    
    def get_metrics(self):
        """메트릭 조회"""
        uptime = (datetime.utcnow() - self.start_time).total_seconds()
        
        metrics = {
            "uptime_seconds": uptime,
            "total_requests": sum(self.request_count.values()),
            "total_errors": sum(self.error_count.values()),
            "endpoints": {}
        }
        
        for endpoint, count in self.request_count.items():
            times = self.response_times[endpoint]
            metrics["endpoints"][endpoint] = {
                "requests": count,
                "errors": self.error_count[endpoint],
                "avg_response_time": sum(times) / len(times) if times else 0,
                "error_rate": self.error_count[endpoint] / count if count > 0 else 0
            }
        
        return metrics

# 글로벌 메트릭 인스턴스
metrics = Metrics()
