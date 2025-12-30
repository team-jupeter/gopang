#!/usr/bin/env python3
"""
OpenHash 신뢰도 계산 시스템 (명세서 도 5, 도 8)
"""
import sqlite3
import math
from datetime import datetime
from typing import Dict, Optional

DB_PATH = "/home/ec2-user/gopang/database/gopang.db"

class TrustCalculator:
    """
    다차원 신뢰도 계산 (명세서 도 8)
    
    Trust_Score = Network_Score × Layer_Weight × 
                  Signer_Trust × Time_Factor × Cross_Score
    """
    
    # Layer별 가중치 (명세서 도 8)
    LAYER_WEIGHTS = {
        0: 1.0,   # 개인
        1: 1.0,   # 읍면동
        2: 1.5,   # 시군구
        3: 2.0,   # 광역시도
        4: 2.5    # 국가
    }
    
    # 사용자 유형별 기본 신뢰도 (명세서 도 4)
    USER_TYPE_TRUST = {
        'personal': 1.0,      # 개인
        'expert': 1.2,        # 전문가
        'official': 1.3,      # 공무원
        'company': 1.1,       # 일반 기업
        'financial': 1.3,     # 금융기관
        'government': 1.5,    # 정부기관
        'international': 2.0  # 국제기구
    }
    
    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
    
    def __del__(self):
        if hasattr(self, 'conn'):
            self.conn.close()
    
    def calculate_time_factor(self, created_at: str) -> float:
        """
        시간 경과 계수 (명세서 도 5)
        
        Time_Factor = 1 + log(1 + Days/365)
        
        - 1일 후: 1.003배
        - 1개월 후: 1.08배
        - 1년 후: 1.69배
        - 10년 후: 2.04배
        """
        try:
            created = datetime.fromisoformat(created_at.replace(' ', 'T'))
            now = datetime.now()
            days = (now - created).total_seconds() / 86400  # 초를 일로 변환
            
            # 명세서 공식
            time_factor = 1 + math.log(1 + days / 365)
            
            return round(time_factor, 4)
        except:
            return 1.0
    
    def calculate_layer_weight(self, layer: int, participated_layers: int = 1) -> float:
        """
        계층 위치 가중치 (명세서 도 8)
        
        기본 가중치 + 교차 검증 보너스
        - Layer 1: 1.0
        - Layer 2: 1.5
        - Layer 3: 2.0
        - Layer 4: 2.5
        - 교차 검증: 0.2 × (참여 계층 수 - 1)
        """
        base_weight = self.LAYER_WEIGHTS.get(layer, 1.0)
        
        # 여러 계층에서 교차 검증된 경우 보너스
        if participated_layers > 1:
            cross_verify_bonus = 0.2 * (participated_layers - 1)
            return base_weight + cross_verify_bonus
        
        return base_weight
    
    def calculate_signer_trust(self, user_id: str) -> float:
        """
        서명자 신뢰도 (명세서 도 8)
        
        - 개인: 1.0 (기본)
        - 전문가: 1.2
        - 공무원: 1.3
        - 기업: 1.1-1.4
        - 정부기관: 1.5-2.0
        - 국제기구: 2.0
        """
        cursor = self.conn.cursor()
        
        # 사람 사용자
        cursor.execute("""
            SELECT user_type FROM users WHERE user_id = ?
        """, (user_id,))
        user = cursor.fetchone()
        
        if user:
            user_type = user['user_type']
            return self.USER_TYPE_TRUST.get(user_type, 1.0)
        
        # AI 사용자
        cursor.execute("""
            SELECT ai_type FROM ai_users WHERE ai_id = ?
        """, (user_id,))
        ai_user = cursor.fetchone()
        
        if ai_user:
            ai_type = ai_user['ai_type']
            if ai_type == 'institution':
                return 1.5  # 기관 AI
            else:
                return 1.0  # 개인 AI
        
        return 1.0  # 기본값
    
    def calculate_network_score(self, layer: int) -> float:
        """
        네트워크 규모 점수 (명세서 도 8)
        
        Network_Score = log₂(참여자 수)
        Weight = 1 + (Score-10)/20
        
        - 1,000명: 10점 → 가중치 1.0
        - 100,000,000명: 26.6점 → 가중치 1.83
        """
        # 프로토타입에서는 간단히 Layer별 예상 참여자 수 사용
        estimated_participants = {
            0: 1,           # 개인
            1: 3000,        # 읍면동
            2: 200000,      # 시군구
            3: 3000000,     # 광역시도
            4: 51000000     # 국가
        }
        
        participants = estimated_participants.get(layer, 1000)
        
        if participants <= 0:
            return 1.0
        
        score = math.log2(participants)
        weight = 1 + (score - 10) / 20
        
        return round(max(1.0, weight), 4)
    
    def calculate_cross_score(self, hash_id: str) -> float:
        """
        교차 검증 점수 (명세서 도 8)
        
        Cross_Score = √(실제검증횟수/예상검증횟수)
        
        - 0.1: 의심
        - 1.0: 정상
        - 2.0: 매우 중요
        """
        cursor = self.conn.cursor()
        
        # 해당 해시가 저장된 Layer 수 확인
        cursor.execute("""
            SELECT COUNT(DISTINCT layer) as layer_count
            FROM layer_storage
            WHERE hash_id = ?
        """, (hash_id,))
        
        result = cursor.fetchone()
        layer_count = result['layer_count'] if result else 1
        
        # 간단한 교차 검증 점수 (실제로는 더 복잡)
        # 여러 계층에 저장될수록 높은 점수
        if layer_count >= 3:
            return 1.5
        elif layer_count >= 2:
            return 1.2
        else:
            return 1.0
    
    def calculate_trust(self, hash_id: str) -> Dict:
        """
        종합 신뢰도 계산
        
        Trust_Score = Network_Score × Layer_Weight × 
                      Signer_Trust × Time_Factor × Cross_Score
        """
        cursor = self.conn.cursor()
        
        # 해시 정보 조회
        cursor.execute("""
            SELECT 
                hash_id,
                user_id,
                layer,
                created_at
            FROM openhash_records
            WHERE hash_id = ?
        """, (hash_id,))
        
        record = cursor.fetchone()
        
        if not record:
            return {
                'error': 'Hash not found',
                'trust_score': 0.0
            }
        
        # 각 차원 계산
        network_score = self.calculate_network_score(record['layer'])
        layer_weight = self.calculate_layer_weight(record['layer'])
        signer_trust = self.calculate_signer_trust(record['user_id'])
        time_factor = self.calculate_time_factor(record['created_at'])
        cross_score = self.calculate_cross_score(hash_id)
        
        # 종합 신뢰도 (명세서 도 8)
        trust_score = (network_score * layer_weight * 
                       signer_trust * time_factor * cross_score)
        
        return {
            'hash_id': hash_id,
            'trust_score': round(trust_score, 4),
            'components': {
                'network_score': network_score,
                'layer_weight': layer_weight,
                'signer_trust': signer_trust,
                'time_factor': time_factor,
                'cross_score': cross_score
            },
            'layer': record['layer'],
            'created_at': record['created_at']
        }
    
    def get_all_trust_scores(self) -> list:
        """모든 해시의 신뢰도 계산"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            SELECT hash_id
            FROM openhash_records
            ORDER BY created_at DESC
        """)
        
        hash_ids = [row['hash_id'] for row in cursor.fetchall()]
        
        results = []
        for hash_id in hash_ids:
            trust_data = self.calculate_trust(hash_id)
            if 'error' not in trust_data:
                results.append(trust_data)
        
        return results

if __name__ == '__main__':
    print("=== 신뢰도 계산 테스트 ===")
    print("")
    
    calculator = TrustCalculator()
    
    # 모든 해시의 신뢰도 계산
    trust_scores = calculator.get_all_trust_scores()
    
    if not trust_scores:
        print("계산할 해시가 없습니다.")
    else:
        print(f"총 {len(trust_scores)}개 해시의 신뢰도:")
        print("")
        
        for ts in trust_scores[:5]:  # 최근 5개만 표시
            print(f"Hash ID: {ts['hash_id']}")
            print(f"신뢰도 점수: {ts['trust_score']}")
            print(f"  - 네트워크: {ts['components']['network_score']}")
            print(f"  - 계층: {ts['components']['layer_weight']}")
            print(f"  - 서명자: {ts['components']['signer_trust']}")
            print(f"  - 시간: {ts['components']['time_factor']}")
            print(f"  - 교차검증: {ts['components']['cross_score']}")
            print(f"  Layer: {ts['layer']}")
            print("")
        
        # 평균 신뢰도
        avg_trust = sum(ts['trust_score'] for ts in trust_scores) / len(trust_scores)
        print(f"평균 신뢰도: {avg_trust:.4f}")
    
    print("✅ 신뢰도 계산 완료!")
