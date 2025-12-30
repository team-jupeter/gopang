#!/usr/bin/env python3
"""
AI 기반 오염 탐지 시스템 (명세서 도 9)

프로토타입: 통계적 이상 탐지 + 기본 머신러닝
완전 구현: CNN (16×16) + LSTM (50개 시계열)
"""
import numpy as np
import sqlite3
from typing import Dict, List, Tuple
from datetime import datetime, timedelta
from collections import deque

DB_PATH = "/home/ec2-user/gopang/database/gopang.db"

class PollutionDetector:
    """
    오염 탐지 시스템
    
    Phase 1 (프로토타입): 통계적 방법
    - 표준편차 기반 이상 탐지
    - 패턴 분석
    - 빈도 분석
    
    Phase 2 (완전 구현): 딥러닝
    - CNN: 해시 패턴 (16×16 이미지)
    - LSTM: 시계열 분석 (50개)
    - 97.3% 정확도 목표
    """
    
    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
        self.threshold_std = 3.0  # 3-시그마 규칙
        self.window_size = 50     # 분석 윈도우
        self._create_detection_table()
    
    def __del__(self):
        if hasattr(self, 'conn'):
            self.conn.close()
    
    def _create_detection_table(self):
        """오염 탐지 결과 테이블"""
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS pollution_detections (
                detection_id INTEGER PRIMARY KEY AUTOINCREMENT,
                hash_id TEXT NOT NULL,
                detection_method TEXT NOT NULL,
                anomaly_score REAL NOT NULL,
                is_polluted BOOLEAN NOT NULL,
                detected_at TEXT NOT NULL,
                details TEXT,
                FOREIGN KEY (hash_id) REFERENCES openhash_records(hash_id)
            )
        """)
        self.conn.commit()
    
    def hash_to_features(self, hash_hex: str) -> np.ndarray:
        """
        해시를 특징 벡터로 변환
        
        Args:
            hash_hex: 64자 16진수 해시
        
        Returns:
            256차원 특징 벡터 (각 바이트를 0-1로 정규화)
        """
        # 16진수 → 바이트 배열
        hash_bytes = bytes.fromhex(hash_hex)
        
        # 바이트 → [0, 1] 정규화
        features = np.array([b / 255.0 for b in hash_bytes])
        
        return features
    
    def detect_statistical_anomaly(self, hash_id: str) -> Dict:
        """
        통계적 이상 탐지 (프로토타입)
        
        방법:
        1. 최근 50개 해시의 특징 분포 학습
        2. 새 해시와 비교
        3. 3-시그마 규칙으로 이상 판별
        """
        cursor = self.conn.cursor()
        
        # 대상 해시 조회
        cursor.execute("""
            SELECT content_hash FROM openhash_records
            WHERE hash_id = ?
        """, (hash_id,))
        
        target_record = cursor.fetchone()
        if not target_record:
            return {'error': 'Hash not found'}
        
        target_hash = target_record['content_hash']
        target_features = self.hash_to_features(target_hash)
        
        # 최근 N개 해시 조회 (학습 데이터)
        cursor.execute("""
            SELECT content_hash FROM openhash_records
            WHERE hash_id != ?
            ORDER BY created_at DESC
            LIMIT ?
        """, (hash_id, self.window_size))
        
        recent_hashes = cursor.fetchall()
        
        if len(recent_hashes) < 10:
            # 데이터 부족
            return {
                'hash_id': hash_id,
                'method': 'statistical',
                'anomaly_score': 0.0,
                'is_polluted': False,
                'message': 'Insufficient data'
            }
        
        # 특징 행렬 생성
        features_matrix = np.array([
            self.hash_to_features(row['content_hash'])
            for row in recent_hashes
        ])
        
        # 통계 계산
        mean = np.mean(features_matrix, axis=0)
        std = np.std(features_matrix, axis=0)
        
        # Z-스코어 계산
        z_scores = np.abs((target_features - mean) / (std + 1e-10))
        max_z_score = np.max(z_scores)
        avg_z_score = np.mean(z_scores)
        
        # 이상 판별
        is_polluted = max_z_score > self.threshold_std
        
        # 결과 저장
        cursor.execute("""
            INSERT INTO pollution_detections
            (hash_id, detection_method, anomaly_score, is_polluted, detected_at, details)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            hash_id,
            'statistical_zscore',
            float(max_z_score),
            is_polluted,
            datetime.now().isoformat(),
            f"max_z={max_z_score:.3f}, avg_z={avg_z_score:.3f}"
        ))
        
        self.conn.commit()
        
        return {
            'hash_id': hash_id,
            'method': 'statistical',
            'anomaly_score': float(max_z_score),
            'is_polluted': is_polluted,
            'threshold': self.threshold_std,
            'details': {
                'max_z_score': float(max_z_score),
                'avg_z_score': float(avg_z_score),
                'samples_used': len(recent_hashes)
            }
        }
    
    def detect_pattern_anomaly(self, hash_id: str) -> Dict:
        """
        패턴 기반 이상 탐지
        
        방법:
        1. 해시의 엔트로피 계산
        2. 비트 분포 분석
        3. 반복 패턴 탐지
        """
        cursor = self.conn.cursor()
        
        cursor.execute("""
            SELECT content_hash FROM openhash_records
            WHERE hash_id = ?
        """, (hash_id,))
        
        record = cursor.fetchone()
        if not record:
            return {'error': 'Hash not found'}
        
        hash_hex = record['content_hash']
        hash_bytes = bytes.fromhex(hash_hex)
        
        # 1. 엔트로피 계산
        byte_counts = np.bincount(list(hash_bytes), minlength=256)
        probabilities = byte_counts / len(hash_bytes)
        entropy = -np.sum(probabilities * np.log2(probabilities + 1e-10))
        
        # 2. 비트 균형 (0과 1의 비율)
        bits = ''.join(format(b, '08b') for b in hash_bytes)
        ones_ratio = bits.count('1') / len(bits)
        bit_balance = abs(ones_ratio - 0.5)  # 0.5에서 멀수록 불균형
        
        # 3. 연속 반복 탐지
        max_repeat = 0
        current_repeat = 1
        for i in range(1, len(hash_bytes)):
            if hash_bytes[i] == hash_bytes[i-1]:
                current_repeat += 1
                max_repeat = max(max_repeat, current_repeat)
            else:
                current_repeat = 1
        
        # 이상 점수 계산
        # 정상적인 SHA-256 해시:
        # - 엔트로피: ~7.9 (최대 8.0)
        # - 비트 균형: ~0 (0.5에 가까움)
        # - 최대 반복: 1-2
        
        entropy_score = abs(entropy - 7.9) / 0.5  # 7.9±0.5 정상
        balance_score = bit_balance / 0.05         # ±0.05 정상
        repeat_score = max(0, max_repeat - 2) / 3  # 2 이하 정상
        
        anomaly_score = (entropy_score + balance_score + repeat_score) / 3
        is_polluted = anomaly_score > 0.5
        
        # 결과 저장
        cursor.execute("""
            INSERT INTO pollution_detections
            (hash_id, detection_method, anomaly_score, is_polluted, detected_at, details)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (
            hash_id,
            'pattern_analysis',
            float(anomaly_score),
            is_polluted,
            datetime.now().isoformat(),
            f"entropy={entropy:.3f}, balance={bit_balance:.3f}, repeat={max_repeat}"
        ))
        
        self.conn.commit()
        
        return {
            'hash_id': hash_id,
            'method': 'pattern',
            'anomaly_score': float(anomaly_score),
            'is_polluted': is_polluted,
            'details': {
                'entropy': float(entropy),
                'expected_entropy': 7.9,
                'bit_balance': float(bit_balance),
                'max_repeat': int(max_repeat),
                'entropy_score': float(entropy_score),
                'balance_score': float(balance_score),
                'repeat_score': float(repeat_score)
            }
        }
    
    def detect_comprehensive(self, hash_id: str) -> Dict:
        """
        종합 오염 탐지
        
        여러 방법을 결합하여 최종 판단
        """
        # 통계적 탐지
        stat_result = self.detect_statistical_anomaly(hash_id)
        
        # 패턴 탐지
        pattern_result = self.detect_pattern_anomaly(hash_id)
        
        # 종합 점수 (가중 평균)
        if 'error' in stat_result or 'error' in pattern_result:
            return {'error': 'Detection failed'}
        
        combined_score = (
            0.6 * stat_result['anomaly_score'] +
            0.4 * pattern_result['anomaly_score']
        )
        
        # 어느 하나라도 오염으로 판단하면 오염
        is_polluted = stat_result['is_polluted'] or pattern_result['is_polluted']
        
        return {
            'hash_id': hash_id,
            'method': 'comprehensive',
            'combined_score': float(combined_score),
            'is_polluted': is_polluted,
            'confidence': 0.85 if is_polluted else 0.95,
            'components': {
                'statistical': stat_result,
                'pattern': pattern_result
            }
        }
    
    def get_pollution_statistics(self) -> Dict:
        """오염 탐지 통계"""
        cursor = self.conn.cursor()
        
        # 전체 탐지 수
        cursor.execute("SELECT COUNT(*) FROM pollution_detections")
        total = cursor.fetchone()[0]
        
        # 오염 탐지 수
        cursor.execute("SELECT COUNT(*) FROM pollution_detections WHERE is_polluted = TRUE")
        polluted = cursor.fetchone()[0]
        
        # 방법별 통계
        cursor.execute("""
            SELECT detection_method, COUNT(*) as count, AVG(anomaly_score) as avg_score
            FROM pollution_detections
            GROUP BY detection_method
        """)
        
        methods = {}
        for row in cursor.fetchall():
            methods[row['detection_method']] = {
                'count': row['count'],
                'avg_score': round(row['avg_score'], 4)
            }
        
        return {
            'total_detections': total,
            'polluted_count': polluted,
            'clean_count': total - polluted,
            'pollution_rate': round(polluted / total * 100, 2) if total > 0 else 0,
            'methods': methods
        }

# ============== 향후 완전 구현 (CNN + LSTM) ==============

class HashCNN:
    """
    CNN 기반 해시 패턴 분석 (향후 구현)
    
    입력: 16×16 이미지 (256바이트 해시)
    출력: [정상, 오염] 확률
    """
    pass

class HashLSTM:
    """
    LSTM 기반 시계열 분석 (향후 구현)
    
    입력: 50개 연속 해시
    출력: [정상, 오염] 확률
    """
    pass

if __name__ == '__main__':
    print("=== AI 오염 탐지 테스트 ===")
    print("")
    
    detector = PollutionDetector()
    
    # 테스트용 해시 ID (실제 데이터베이스에서)
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT hash_id FROM openhash_records LIMIT 1")
    result = cursor.fetchone()
    
    if result:
        test_hash_id = result[0]
        
        print(f"테스트 해시: {test_hash_id}")
        print("")
        
        # 1. 통계적 탐지
        print("1. 통계적 탐지...")
        stat_result = detector.detect_statistical_anomaly(test_hash_id)
        print(f"   - 이상 점수: {stat_result.get('anomaly_score', 'N/A')}")
        print(f"   - 오염 여부: {stat_result.get('is_polluted', 'N/A')}")
        print("")
        
        # 2. 패턴 탐지
        print("2. 패턴 탐지...")
        pattern_result = detector.detect_pattern_anomaly(test_hash_id)
        print(f"   - 이상 점수: {pattern_result.get('anomaly_score', 'N/A')}")
        print(f"   - 오염 여부: {pattern_result.get('is_polluted', 'N/A')}")
        if 'details' in pattern_result:
            print(f"   - 엔트로피: {pattern_result['details'].get('entropy', 'N/A')}")
            print(f"   - 비트 균형: {pattern_result['details'].get('bit_balance', 'N/A')}")
        print("")
        
        # 3. 종합 탐지
        print("3. 종합 탐지...")
        comp_result = detector.detect_comprehensive(test_hash_id)
        print(f"   - 종합 점수: {comp_result.get('combined_score', 'N/A')}")
        print(f"   - 오염 여부: {comp_result.get('is_polluted', 'N/A')}")
        print(f"   - 신뢰도: {comp_result.get('confidence', 'N/A')}")
        print("")
        
        # 4. 통계
        print("4. 오염 탐지 통계...")
        stats = detector.get_pollution_statistics()
        print(f"   - 총 탐지: {stats['total_detections']}")
        print(f"   - 오염: {stats['polluted_count']}")
        print(f"   - 정상: {stats['clean_count']}")
        print(f"   - 오염률: {stats['pollution_rate']}%")
        
    else:
        print("테스트할 해시가 없습니다.")
    
    conn.close()
    
    print("")
    print("✅ 오염 탐지 테스트 완료!")
    print("")
    print("📝 참고:")
    print("  - 현재: 통계적 방법 (프로토타입)")
    print("  - 향후: CNN + LSTM (97.3% 정확도)")
