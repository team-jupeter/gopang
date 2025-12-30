#!/usr/bin/env python3
"""
OpenHash 해시 생성 및 Layer 선택 로직
"""
import hashlib
import sqlite3
from datetime import datetime
from typing import Tuple

DB_PATH = "/home/ec2-user/gopang/database/gopang.db"

# Layer별 AI 매핑
LAYER_AI_MAPPING = {
    1: {  # 읍면동
        '5011025000': 'ai_06',  # 한림읍
        '5011010600': 'ai_11',  # 노형동
        '5013052000': 'ai_05',  # 중앙동
        '5013077000': 'ai_10',  # 안덕면
    },
    2: {  # 시군구
        '5011': 'ai_07',  # 제주시
        '5013': 'ai_08',  # 서귀포시
    },
    3: {  # 광역시도
        '50': 'ai_09',  # 제주특별자치도
    },
    4: ['ai_01', 'ai_02', 'ai_03', 'ai_04']  # 국가 AI들
}

def generate_hash(content: str) -> str:
    """
    SHA-256 해시 생성
    """
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def select_layer_probabilistic(hash_value: str) -> int:
    """
    확률적 Layer 선택
    
    확률 분포:
    - Layer 0 (개인): 60%
    - Layer 1 (읍면동): 20%
    - Layer 2 (시군구): 10%
    - Layer 3 (광역시도): 7%
    - Layer 4 (국가): 3%
    """
    # 해시의 마지막 2자리를 숫자로 변환 (0-255)
    last_byte = int(hash_value[-2:], 16)
    
    if last_byte < 153:  # 0-152: 60%
        return 0
    elif last_byte < 204:  # 153-203: 20%
        return 1
    elif last_byte < 230:  # 204-229: 10%
        return 2
    elif last_byte < 248:  # 230-247: 7%
        return 3
    else:  # 248-255: 3%
        return 4

def get_target_ai(layer: int, region_code: str) -> str:
    """
    Layer와 지역 코드에 따라 타겟 AI 결정
    """
    if layer == 0:
        return None  # 개인 저장 (AI에게 전송 안 함)
    elif layer == 1:
        return LAYER_AI_MAPPING[1].get(region_code, 'ai_06')
    elif layer == 2:
        city_code = region_code[:4]
        return LAYER_AI_MAPPING[2].get(city_code, 'ai_07')
    elif layer == 3:
        province_code = region_code[:2]
        return LAYER_AI_MAPPING[3].get(province_code, 'ai_09')
    elif layer == 4:
        # 해시 기반 라운드 로빈
        idx = int(hashlib.md5(region_code.encode()).hexdigest()[-1], 16) % 4
        return LAYER_AI_MAPPING[4][idx]
    else:
        return None

def create_hash_record(user_id: str, content: str, content_type: str = 'conversation') -> Tuple[str, int, str]:
    """
    대화 내용을 해시로 변환하고 데이터베이스에 저장
    
    Returns:
        (hash_id, layer, target_ai_id)
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 사용자 지역 코드 조회
    cursor.execute("SELECT region_code FROM users WHERE user_id = ?", (user_id,))
    result = cursor.fetchone()
    region_code = result[0] if result and result[0] else '5011025000'  # 기본값: 한림읍
    
    # 해시 생성
    content_hash = generate_hash(content)
    hash_id = f"hash_{datetime.now().strftime('%Y%m%d%H%M%S')}_{content_hash[:8]}"
    
    # 확률적 Layer 선택
    layer = select_layer_probabilistic(content_hash)
    
    # 타겟 AI 결정
    target_ai = get_target_ai(layer, region_code)
    
    # openhash_records에 저장
    cursor.execute('''
        INSERT INTO openhash_records 
        (hash_id, user_id, content_type, content_hash, layer, transmitted)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (hash_id, user_id, content_type, content_hash, layer, False))
    
    # Layer 0이 아니면 layer_storage에도 저장
    if layer > 0 and target_ai:
        cursor.execute('''
            INSERT INTO layer_storage 
            (hash_id, layer, ai_id)
            VALUES (?, ?, ?)
        ''', (hash_id, layer, target_ai))
    
    conn.commit()
    conn.close()
    
    return (hash_id, layer, target_ai)

def get_hash_statistics() -> dict:
    """
    OpenHash 통계 조회
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Layer별 해시 수
    cursor.execute('''
        SELECT layer, COUNT(*) as count
        FROM openhash_records
        GROUP BY layer
        ORDER BY layer
    ''')
    layer_stats = {row[0]: row[1] for row in cursor.fetchall()}
    
    # 전체 해시 수
    cursor.execute("SELECT COUNT(*) FROM openhash_records")
    total = cursor.fetchone()[0]
    
    conn.close()
    
    return {
        'total': total,
        'by_layer': layer_stats
    }

if __name__ == '__main__':
    # 테스트
    print("=== OpenHash 테스트 ===")
    
    # 테스트 해시 생성
    test_user = 'test_user'
    test_message = "안녕하세요, 테스트 메시지입니다."
    
    hash_id, layer, target_ai = create_hash_record(test_user, test_message)
    
    print(f"Hash ID: {hash_id}")
    print(f"Layer: {layer}")
    print(f"Target AI: {target_ai}")
    print("")
    
    # 통계 출력
    stats = get_hash_statistics()
    print(f"총 해시: {stats['total']}개")
    print("Layer별 분포:")
    for layer, count in stats['by_layer'].items():
        print(f"  Layer {layer}: {count}개")
