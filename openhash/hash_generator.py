#!/usr/bin/env python3
"""
OpenHash 해시 생성 및 Layer 선택 로직 (명세서 준수)
"""
import hashlib
import sqlite3
import time
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

def select_layer_probabilistic_spec(doc_hash: str, timestamp: int, region_code: str) -> Tuple[int, str]:
    """
    명세서 준수: 확률적 계층 선택 알고리즘 (도 6)
    
    단계 1: 입력 데이터 준비
    - 문서 해시: H_doc = SHA256(document)
    - 타임스탬프: T = Unix timestamp
    - 지역코드: R = region_identifier
    
    단계 2: 결합 해시 생성
    - H_combined = SHA256(H_doc || T || R)
    
    단계 3: 균등분포 난수 생성
    - random_value = (H_combined의 상위 8바이트를 64비트 정수로 변환) mod 1000
    
    단계 4: 확률적 계층 결정
    - if random_value < 700: 선택 = Layer 1 (70%)
    - elif random_value < 900: 선택 = Layer 2 (20%)
    - else: 선택 = Layer 3 (10%)
    
    Returns:
        (layer, H_combined)
    """
    # 단계 1: 입력 데이터 준비
    H_doc = doc_hash
    T = str(timestamp).encode('utf-8')
    R = region_code.encode('utf-8')
    
    # 단계 2: 결합 해시 생성
    combined_data = H_doc.encode('utf-8') + T + R
    H_combined = hashlib.sha256(combined_data).hexdigest()
    
    # 단계 3: 균등분포 난수 생성
    # 상위 8바이트 추출 (16진수 문자열의 처음 16자 = 8바이트)
    bytes_8_hex = H_combined[:16]
    
    # 64비트 정수로 변환 (big-endian)
    uint64_value = int(bytes_8_hex, 16)
    
    # 모듈로 연산
    random_value = uint64_value % 1000
    
    # 단계 4: 계층 결정 (70%, 20%, 10%)
    if random_value < 700:
        layer = 1
    elif random_value < 900:
        layer = 2
    else:
        layer = 3
    
    return (layer, H_combined)

def get_target_ai(layer: int, region_code: str, H_combined: str) -> str:
    """
    Layer와 지역 코드에 따라 타겟 AI 결정
    """
    if layer == 0:
        return None  # 개인 저장
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
        idx = int(H_combined[-1], 16) % 4
        return LAYER_AI_MAPPING[4][idx]
    else:
        return None

def create_hash_record(user_id: str, content: str, content_type: str = 'conversation') -> Tuple[str, int, str, dict]:
    """
    대화 내용을 해시로 변환하고 데이터베이스에 저장 (명세서 준수)
    
    Returns:
        (hash_id, layer, target_ai_id, metadata)
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 사용자 지역 코드 조회
    cursor.execute("SELECT region_code FROM users WHERE user_id = ?", (user_id,))
    result = cursor.fetchone()
    region_code = result[0] if result and result[0] else '5011025000'
    
    # 단계 1: 문서 해시 생성
    content_hash = generate_hash(content)
    
    # 단계 2: 타임스탬프 (Unix timestamp, 초 단위)
    timestamp = int(time.time())
    
    # 단계 3: 명세서 준수 확률적 Layer 선택
    layer, H_combined = select_layer_probabilistic_spec(content_hash, timestamp, region_code)
    
    # 단계 4: 타겟 AI 결정
    target_ai = get_target_ai(layer, region_code, H_combined)
    
    # hash_id 생성 (명세서 형식)
    hash_id = f"hash_{datetime.now().strftime('%Y%m%d%H%M%S')}_{content_hash[:8]}"
    
    # openhash_records에 저장
    cursor.execute('''
        INSERT INTO openhash_records 
        (hash_id, user_id, content_type, content_hash, layer, transmitted)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (hash_id, user_id, content_type, H_combined, layer, False))
    
    # Layer 0이 아니면 layer_storage에도 저장
    if layer > 0 and target_ai:
        cursor.execute('''
            INSERT INTO layer_storage 
            (hash_id, layer, ai_id)
            VALUES (?, ?, ?)
        ''', (hash_id, layer, target_ai))
    
    conn.commit()
    conn.close()
    
    # 메타데이터
    metadata = {
        'original_hash': content_hash,
        'combined_hash': H_combined,
        'timestamp': timestamp,
        'region_code': region_code,
        'algorithm': 'SHA256(H_doc || T || R)'
    }
    
    return (hash_id, layer, target_ai, metadata)

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
    
    # Layer별 AI 분포
    cursor.execute('''
        SELECT ls.ai_id, au.ai_name, COUNT(*) as count
        FROM layer_storage ls
        JOIN ai_users au ON ls.ai_id = au.ai_id
        GROUP BY ls.ai_id, au.ai_name
        ORDER BY count DESC
    ''')
    ai_distribution = [
        {'ai_id': row[0], 'ai_name': row[1], 'count': row[2]}
        for row in cursor.fetchall()
    ]
    
    conn.close()
    
    return {
        'total': total,
        'by_layer': layer_stats,
        'ai_distribution': ai_distribution
    }

if __name__ == '__main__':
    # 테스트
    print("=== OpenHash 명세서 준수 테스트 ===")
    print("")
    
    # 테스트 해시 생성
    test_user = 'test_user'
    test_message = "안녕하세요, 명세서 준수 테스트입니다."
    
    hash_id, layer, target_ai, metadata = create_hash_record(test_user, test_message)
    
    print(f"Hash ID: {hash_id}")
    print(f"Layer: {layer}")
    print(f"Target AI: {target_ai}")
    print(f"")
    print(f"메타데이터:")
    print(f"  - 원본 해시: {metadata['original_hash'][:16]}...")
    print(f"  - 결합 해시: {metadata['combined_hash'][:16]}...")
    print(f"  - 타임스탬프: {metadata['timestamp']}")
    print(f"  - 지역 코드: {metadata['region_code']}")
    print(f"  - 알고리즘: {metadata['algorithm']}")
    print("")
    
    # 통계 출력
    stats = get_hash_statistics()
    print(f"총 해시: {stats['total']}개")
    print("Layer별 분포:")
    for layer, count in stats['by_layer'].items():
        print(f"  Layer {layer}: {count}개")
    
    if stats['ai_distribution']:
        print("\nAI별 분포:")
        for ai in stats['ai_distribution']:
            print(f"  {ai['ai_name']}: {ai['count']}개")
