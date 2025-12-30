#!/usr/bin/env python3
"""
OpenHash 해시 생성 및 Layer 선택 로직 + 디지털 서명 통합
"""
import hashlib
import sqlite3
import time
import sys
from datetime import datetime
from typing import Tuple, Optional

# Python 경로 추가
sys.path.insert(0, '/home/ec2-user/gopang')

DB_PATH = "/home/ec2-user/gopang/database/gopang.db"

# Layer별 AI 매핑
LAYER_AI_MAPPING = {
    1: {
        '5011025000': 'ai_06',
        '5011010600': 'ai_11',
        '5013052000': 'ai_05',
        '5013077000': 'ai_10',
    },
    2: {
        '5011': 'ai_07',
        '5013': 'ai_08',
    },
    3: {
        '50': 'ai_09',
    },
    4: ['ai_01', 'ai_02', 'ai_03', 'ai_04']
}

def generate_hash(content: str) -> str:
    """SHA-256 해시 생성"""
    return hashlib.sha256(content.encode('utf-8')).hexdigest()

def select_layer_probabilistic_spec(doc_hash: str, timestamp: int, region_code: str) -> Tuple[int, str]:
    """
    명세서 준수: 확률적 계층 선택 알고리즘
    """
    H_doc = doc_hash
    T = str(timestamp).encode('utf-8')
    R = region_code.encode('utf-8')
    
    combined_data = H_doc.encode('utf-8') + T + R
    H_combined = hashlib.sha256(combined_data).hexdigest()
    
    bytes_8_hex = H_combined[:16]
    uint64_value = int(bytes_8_hex, 16)
    random_value = uint64_value % 1000
    
    if random_value < 700:
        layer = 1
    elif random_value < 900:
        layer = 2
    else:
        layer = 3
    
    return (layer, H_combined)

def get_target_ai(layer: int, region_code: str, H_combined: str) -> str:
    """Layer와 지역 코드에 따라 타겟 AI 결정"""
    if layer == 0:
        return None
    elif layer == 1:
        return LAYER_AI_MAPPING[1].get(region_code, 'ai_06')
    elif layer == 2:
        city_code = region_code[:4]
        return LAYER_AI_MAPPING[2].get(city_code, 'ai_07')
    elif layer == 3:
        province_code = region_code[:2]
        return LAYER_AI_MAPPING[3].get(province_code, 'ai_09')
    elif layer == 4:
        idx = int(H_combined[-1], 16) % 4
        return LAYER_AI_MAPPING[4][idx]
    else:
        return None

def create_hash_record(user_id: str, content: str, content_type: str = 'conversation',
                       sign: bool = True) -> Tuple[str, int, str, dict]:
    """
    대화 내용을 해시로 변환하고 데이터베이스에 저장 + 디지털 서명
    
    Args:
        user_id: 사용자 ID
        content: 내용
        content_type: 내용 유형
        sign: 디지털 서명 추가 여부
    
    Returns:
        (hash_id, layer, target_ai_id, metadata)
    """
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT region_code FROM users WHERE user_id = ?", (user_id,))
    result = cursor.fetchone()
    region_code = result[0] if result and result[0] else '5011025000'
    
    content_hash = generate_hash(content)
    timestamp = int(time.time())
    layer, H_combined = select_layer_probabilistic_spec(content_hash, timestamp, region_code)
    target_ai = get_target_ai(layer, region_code, H_combined)
    
    hash_id = f"hash_{datetime.now().strftime('%Y%m%d%H%M%S')}_{content_hash[:8]}"
    
    # 이전 해시 조회 (체인 연결용)
    cursor.execute("""
        SELECT hash_id FROM openhash_records
        ORDER BY created_at DESC
        LIMIT 1
    """)
    prev_record = cursor.fetchone()
    previous_hash = prev_record[0] if prev_record else None
    
    cursor.execute('''
        INSERT INTO openhash_records 
        (hash_id, user_id, content_type, content_hash, layer, transmitted)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (hash_id, user_id, content_type, H_combined, layer, False))
    
    if layer > 0 and target_ai:
        cursor.execute('''
            INSERT INTO layer_storage 
            (hash_id, layer, ai_id)
            VALUES (?, ?, ?)
        ''', (hash_id, layer, target_ai))
    
    conn.commit()
    conn.close()
    
    # 디지털 서명 생성
    signature_info = None
    if sign:
        try:
            from openhash.digital_signature import DigitalSignature
            ds = DigitalSignature()
            signature_info = ds.sign_hash(user_id, hash_id, H_combined, previous_hash)
        except Exception as e:
            print(f"⚠️ 서명 생성 실패: {e}")
    
    metadata = {
        'original_hash': content_hash,
        'combined_hash': H_combined,
        'timestamp': timestamp,
        'region_code': region_code,
        'algorithm': 'SHA256(H_doc || T || R)',
        'previous_hash': previous_hash,
        'signature': signature_info
    }
    
    return (hash_id, layer, target_ai, metadata)

def get_hash_statistics() -> dict:
    """OpenHash 통계 조회"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT layer, COUNT(*) as count
        FROM openhash_records
        GROUP BY layer
        ORDER BY layer
    ''')
    layer_stats = {row[0]: row[1] for row in cursor.fetchall()}
    
    cursor.execute("SELECT COUNT(*) FROM openhash_records")
    total = cursor.fetchone()[0]
    
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
    print("=== OpenHash + 디지털 서명 통합 테스트 ===")
    print("")
    
    test_user = 'test_user'
    test_message = "디지털 서명이 포함된 메시지입니다."
    
    hash_id, layer, target_ai, metadata = create_hash_record(test_user, test_message, sign=True)
    
    print(f"Hash ID: {hash_id}")
    print(f"Layer: {layer}")
    print(f"Target AI: {target_ai}")
    print(f"Previous Hash: {metadata['previous_hash']}")
    print("")
    
    if metadata['signature']:
        print("✅ 디지털 서명 성공:")
        print(f"  - Signature ID: {metadata['signature']['signature_id']}")
        print(f"  - Algorithm: {metadata['signature']['algorithm']}")
        print(f"  - Signer: {metadata['signature']['signer_id']}")
        print(f"  - r: {metadata['signature']['r'][:30]}...")
        print(f"  - s: {metadata['signature']['s'][:30]}...")
        print(f"  - Previous Hash: {metadata['signature']['previous_hash'][:20]}..." if metadata['signature']['previous_hash'] else "  - Previous Hash: None (첫 블록)")
        
        # 서명 검증
        print("")
        print("=== 서명 검증 ===")
        from openhash.digital_signature import DigitalSignature
        ds = DigitalSignature()
        is_valid = ds.verify_signature(hash_id, metadata['combined_hash'])
        print(f"  {'✅' if is_valid else '❌'} 검증 결과: {'성공' if is_valid else '실패'}")
    else:
        print("❌ 디지털 서명 실패")
    
    print("")
    print("✅ 통합 테스트 완료!")
