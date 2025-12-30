#!/usr/bin/env python3
"""
OpenHash 계층 간 해시 전파 시스템
Layer 1 → Layer 2 → Layer 3 → Layer 4
"""
import hashlib
import sqlite3
from datetime import datetime
from typing import List, Dict, Tuple
from collections import defaultdict

DB_PATH = "/home/ec2-user/gopang/database/gopang.db"

class MerkleTree:
    """
    머클트리 구현 (계층 통합용)
    """
    def __init__(self, hashes: List[str]):
        self.hashes = hashes
        self.root = self._build_tree()
    
    def _build_tree(self) -> str:
        """머클 루트 생성"""
        if not self.hashes:
            return hashlib.sha256(b'').hexdigest()
        
        if len(self.hashes) == 1:
            return self.hashes[0]
        
        # 레벨별로 해시를 쌍으로 결합
        current_level = self.hashes[:]
        
        while len(current_level) > 1:
            next_level = []
            
            # 쌍으로 처리
            for i in range(0, len(current_level), 2):
                if i + 1 < len(current_level):
                    # 두 해시 결합
                    combined = current_level[i] + current_level[i + 1]
                    parent_hash = hashlib.sha256(combined.encode()).hexdigest()
                else:
                    # 홀수 개인 경우 마지막 해시를 복제
                    combined = current_level[i] + current_level[i]
                    parent_hash = hashlib.sha256(combined.encode()).hexdigest()
                
                next_level.append(parent_hash)
            
            current_level = next_level
        
        return current_level[0]

class LayerPropagation:
    """
    계층 간 해시 전파 관리
    """
    
    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
    
    def __del__(self):
        if hasattr(self, 'conn'):
            self.conn.close()
    
    def get_layer_hashes(self, layer: int, transmitted: bool = False) -> List[Dict]:
        """특정 Layer의 해시 목록 조회"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT hash_id, user_id, content_hash, created_at
            FROM openhash_records
            WHERE layer = ? AND transmitted = ?
            ORDER BY created_at
        """, (layer, transmitted))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def propagate_layer_1_to_2(self) -> Dict:
        """
        Layer 1 (읍면동) → Layer 2 (시군구) 전파
        """
        cursor = self.conn.cursor()
        
        # Layer 1의 미전송 해시들을 지역별로 그룹화
        cursor.execute("""
            SELECT 
                h.hash_id, 
                h.content_hash,
                u.region_code,
                ls.ai_id
            FROM openhash_records h
            JOIN users u ON h.user_id = u.user_id
            JOIN layer_storage ls ON h.hash_id = ls.hash_id
            WHERE h.layer = 1 AND h.transmitted = FALSE
        """)
        
        layer1_records = cursor.fetchall()
        
        # 시군구별로 그룹화 (지역코드 앞 4자리)
        city_groups = defaultdict(list)
        for record in layer1_records:
            region_code = record[2]  # region_code
            city_code = region_code[:4] if region_code else '5011'
            city_groups[city_code].append({
                'hash_id': record[0],
                'content_hash': record[1],
                'ai_id': record[3]
            })
        
        results = []
        
        # 각 시군구별로 머클트리 생성
        for city_code, records in city_groups.items():
            hashes = [r['content_hash'] for r in records]
            merkle = MerkleTree(hashes)
            merkle_root = merkle.root
            
            # Layer 2 타겟 AI 결정
            target_ai = 'ai_07' if city_code.startswith('5011') else 'ai_08'
            
            # Layer 2 레코드 생성
            propagation_hash_id = f"prop_L2_{datetime.now().strftime('%Y%m%d%H%M%S')}_{merkle_root[:8]}"
            
            cursor.execute("""
                INSERT INTO openhash_records
                (hash_id, user_id, content_type, content_hash, layer, transmitted)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (propagation_hash_id, 'system', 'propagation', merkle_root, 2, False))
            
            # Layer 2 저장소에 추가
            cursor.execute("""
                INSERT INTO layer_storage
                (hash_id, layer, ai_id)
                VALUES (?, ?, ?)
            """, (propagation_hash_id, 2, target_ai))
            
            # Layer 1 해시들을 transmitted = TRUE로 업데이트
            for record in records:
                cursor.execute("""
                    UPDATE openhash_records
                    SET transmitted = TRUE, transmitted_at = datetime('now')
                    WHERE hash_id = ?
                """, (record['hash_id'],))
            
            results.append({
                'city_code': city_code,
                'target_ai': target_ai,
                'propagation_hash_id': propagation_hash_id,
                'merkle_root': merkle_root,
                'child_count': len(records)
            })
        
        self.conn.commit()
        
        return {
            'layer_from': 1,
            'layer_to': 2,
            'propagations': results,
            'total_cities': len(city_groups)
        }
    
    def propagate_layer_2_to_3(self) -> Dict:
        """
        Layer 2 (시군구) → Layer 3 (광역시도) 전파
        """
        cursor = self.conn.cursor()
        
        # Layer 2의 미전송 해시들 조회
        cursor.execute("""
            SELECT hash_id, content_hash
            FROM openhash_records
            WHERE layer = 2 AND transmitted = FALSE
        """)
        
        layer2_records = cursor.fetchall()
        
        if not layer2_records:
            return {
                'layer_from': 2,
                'layer_to': 3,
                'propagations': [],
                'message': 'No records to propagate'
            }
        
        # 모든 Layer 2 해시를 하나의 머클트리로 통합
        hashes = [r[1] for r in layer2_records]  # content_hash
        merkle = MerkleTree(hashes)
        merkle_root = merkle.root
        
        # Layer 3 타겟 AI (제주특별자치도)
        target_ai = 'ai_09'
        
        # Layer 3 레코드 생성
        propagation_hash_id = f"prop_L3_{datetime.now().strftime('%Y%m%d%H%M%S')}_{merkle_root[:8]}"
        
        cursor.execute("""
            INSERT INTO openhash_records
            (hash_id, user_id, content_type, content_hash, layer, transmitted)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (propagation_hash_id, 'system', 'propagation', merkle_root, 3, False))
        
        # Layer 3 저장소에 추가
        cursor.execute("""
            INSERT INTO layer_storage
            (hash_id, layer, ai_id)
            VALUES (?, ?, ?)
        """, (propagation_hash_id, 3, target_ai))
        
        # Layer 2 해시들을 transmitted = TRUE로 업데이트
        for record in layer2_records:
            cursor.execute("""
                UPDATE openhash_records
                SET transmitted = TRUE, transmitted_at = datetime('now')
                WHERE hash_id = ?
            """, (record[0],))
        
        self.conn.commit()
        
        return {
            'layer_from': 2,
            'layer_to': 3,
            'propagations': [{
                'target_ai': target_ai,
                'propagation_hash_id': propagation_hash_id,
                'merkle_root': merkle_root,
                'child_count': len(layer2_records)
            }],
            'total_provinces': 1
        }
    
    def propagate_layer_3_to_4(self) -> Dict:
        """
        Layer 3 (광역시도) → Layer 4 (국가) 전파
        """
        cursor = self.conn.cursor()
        
        # Layer 3의 미전송 해시들 조회
        cursor.execute("""
            SELECT hash_id, content_hash
            FROM openhash_records
            WHERE layer = 3 AND transmitted = FALSE
        """)
        
        layer3_records = cursor.fetchall()
        
        if not layer3_records:
            return {
                'layer_from': 3,
                'layer_to': 4,
                'propagations': [],
                'message': 'No records to propagate'
            }
        
        # 모든 Layer 3 해시를 하나의 머클트리로 통합
        hashes = [r[1] for r in layer3_records]
        merkle = MerkleTree(hashes)
        merkle_root = merkle.root
        
        # Layer 4 타겟 AI (국가 AI - 라운드 로빈)
        # 해시 기반으로 4개 AI 중 하나 선택
        target_ai_idx = int(merkle_root[-1], 16) % 4
        target_ais = ['ai_01', 'ai_02', 'ai_03', 'ai_04']
        target_ai = target_ais[target_ai_idx]
        
        # Layer 4 레코드 생성
        propagation_hash_id = f"prop_L4_{datetime.now().strftime('%Y%m%d%H%M%S')}_{merkle_root[:8]}"
        
        cursor.execute("""
            INSERT INTO openhash_records
            (hash_id, user_id, content_type, content_hash, layer, transmitted)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (propagation_hash_id, 'system', 'propagation', merkle_root, 4, False))
        
        # Layer 4 저장소에 추가
        cursor.execute("""
            INSERT INTO layer_storage
            (hash_id, layer, ai_id)
            VALUES (?, ?, ?)
        """, (propagation_hash_id, 4, target_ai))
        
        # Layer 3 해시들을 transmitted = TRUE로 업데이트
        for record in layer3_records:
            cursor.execute("""
                UPDATE openhash_records
                SET transmitted = TRUE, transmitted_at = datetime('now')
                WHERE hash_id = ?
            """, (record[0],))
        
        self.conn.commit()
        
        return {
            'layer_from': 3,
            'layer_to': 4,
            'propagations': [{
                'target_ai': target_ai,
                'propagation_hash_id': propagation_hash_id,
                'merkle_root': merkle_root,
                'child_count': len(layer3_records)
            }],
            'total_nations': 1
        }
    
    def propagate_all(self) -> Dict:
        """
        모든 계층 전파 실행
        """
        results = {
            'timestamp': datetime.now().isoformat(),
            'propagations': []
        }
        
        # Layer 1 → 2
        l1_to_l2 = self.propagate_layer_1_to_2()
        results['propagations'].append(l1_to_l2)
        
        # Layer 2 → 3
        l2_to_l3 = self.propagate_layer_2_to_3()
        results['propagations'].append(l2_to_l3)
        
        # Layer 3 → 4
        l3_to_l4 = self.propagate_layer_3_to_4()
        results['propagations'].append(l3_to_l4)
        
        return results

if __name__ == '__main__':
    print("=== 계층 간 해시 전파 테스트 ===")
    print("")
    
    propagation = LayerPropagation()
    
    # 전체 전파 실행
    results = propagation.propagate_all()
    
    print(f"전파 시각: {results['timestamp']}")
    print("")
    
    for prop in results['propagations']:
        print(f"Layer {prop['layer_from']} → Layer {prop['layer_to']}")
        
        if 'propagations' in prop and prop['propagations']:
            for detail in prop['propagations']:
                print(f"  - 타겟 AI: {detail['target_ai']}")
                print(f"  - 전파 해시: {detail['propagation_hash_id']}")
                print(f"  - 머클 루트: {detail['merkle_root'][:16]}...")
                print(f"  - 자식 수: {detail['child_count']}")
                print("")
        elif 'message' in prop:
            print(f"  {prop['message']}")
            print("")
    
    print("✅ 전파 완료!")
