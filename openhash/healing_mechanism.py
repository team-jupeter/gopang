#!/usr/bin/env python3
"""
선별적 치유 메커니즘 (명세서 도 10)
"""
import sys
sys.path.insert(0, '/home/ec2-user/gopang')

import sqlite3
from datetime import datetime
from typing import Dict, List, Optional
from enum import Enum

DB_PATH = "/home/ec2-user/gopang/database/gopang.db"

class HealingStatus(Enum):
    """치유 상태"""
    DETECTED = "detected"
    QUARANTINED = "quarantined"
    RECOVERING = "recovering"
    VERIFIED = "verified"
    HEALED = "healed"
    FAILED = "failed"

class HealingMechanism:
    """선별적 치유 시스템"""
    
    def __init__(self):
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
        self._create_healing_table()
    
    def __del__(self):
        if hasattr(self, 'conn'):
            self.conn.close()
    
    def _create_healing_table(self):
        """치유 기록 테이블"""
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS healing_records (
                healing_id INTEGER PRIMARY KEY AUTOINCREMENT,
                hash_id TEXT NOT NULL,
                detected_at TEXT NOT NULL,
                quarantined_at TEXT,
                recovery_started_at TEXT,
                verified_at TEXT,
                healed_at TEXT,
                status TEXT NOT NULL,
                source_nodes TEXT,
                recovery_method TEXT,
                verification_result TEXT,
                FOREIGN KEY (hash_id) REFERENCES openhash_records(hash_id)
            )
        """)
        
        try:
            cursor.execute("""
                ALTER TABLE openhash_records 
                ADD COLUMN quarantined BOOLEAN DEFAULT FALSE
            """)
        except:
            pass
        
        self.conn.commit()
    
    def detect_and_quarantine(self, hash_id: str) -> Dict:
        """1단계: 오염 탐지 및 격리"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            SELECT hash_id, content_hash, layer
            FROM openhash_records
            WHERE hash_id = ?
        """, (hash_id,))
        
        record = cursor.fetchone()
        if not record:
            return {'error': 'Hash not found'}
        
        # 오염 탐지
        from openhash.pollution_detection import PollutionDetector
        detector = PollutionDetector()
        detection_result = detector.detect_comprehensive(hash_id)
        
        if not detection_result.get('is_polluted'):
            return {
                'hash_id': hash_id,
                'status': 'clean',
                'message': 'No pollution detected'
            }
        
        # 격리
        cursor.execute("""
            UPDATE openhash_records
            SET quarantined = TRUE
            WHERE hash_id = ?
        """, (hash_id,))
        
        now = datetime.now().isoformat()
        cursor.execute("""
            INSERT INTO healing_records
            (hash_id, detected_at, quarantined_at, status)
            VALUES (?, ?, ?, ?)
        """, (hash_id, now, now, HealingStatus.QUARANTINED.value))
        
        healing_id = cursor.lastrowid
        self.conn.commit()
        
        return {
            'healing_id': healing_id,
            'hash_id': hash_id,
            'status': HealingStatus.QUARANTINED.value,
            'detected_at': now,
            'quarantined_at': now,
            'detection_result': detection_result
        }
    
    def recover_from_network(self, hash_id: str) -> Dict:
        """2단계: 네트워크에서 데이터 복원"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            SELECT healing_id FROM healing_records
            WHERE hash_id = ? AND status = ?
        """, (hash_id, HealingStatus.QUARANTINED.value))
        
        healing_record = cursor.fetchone()
        if not healing_record:
            return {'error': 'Not in quarantine'}
        
        healing_id = healing_record['healing_id']
        
        # 다른 Layer에서 동일 해시 찾기
        cursor.execute("""
            SELECT or2.hash_id, or2.content_hash, or2.layer
            FROM openhash_records or1
            JOIN openhash_records or2 ON or1.content_hash = or2.content_hash
            WHERE or1.hash_id = ? AND or2.hash_id != ? AND or2.quarantined = FALSE
            LIMIT 3
        """, (hash_id, hash_id))
        
        source_nodes = cursor.fetchall()
        
        if not source_nodes:
            cursor.execute("""
                UPDATE healing_records
                SET status = ?, recovery_started_at = ?
                WHERE healing_id = ?
            """, (HealingStatus.FAILED.value, datetime.now().isoformat(), healing_id))
            
            self.conn.commit()
            
            return {
                'healing_id': healing_id,
                'hash_id': hash_id,
                'status': HealingStatus.FAILED.value,
                'message': 'No clean copies found'
            }
        
        # 신뢰도 기반 복원
        from openhash.trust_calculator import TrustCalculator
        calculator = TrustCalculator()
        
        best_source = None
        max_trust = 0
        
        for source in source_nodes:
            trust_data = calculator.calculate_trust(source['hash_id'])
            if trust_data['trust_score'] > max_trust:
                max_trust = trust_data['trust_score']
                best_source = source
        
        now = datetime.now().isoformat()
        source_list = ','.join([s['hash_id'] for s in source_nodes])
        
        cursor.execute("""
            UPDATE healing_records
            SET recovery_started_at = ?, 
                status = ?,
                source_nodes = ?,
                recovery_method = ?
            WHERE healing_id = ?
        """, (
            now,
            HealingStatus.RECOVERING.value,
            source_list,
            f"trust_based (trust={max_trust:.4f})",
            healing_id
        ))
        
        self.conn.commit()
        
        return {
            'healing_id': healing_id,
            'hash_id': hash_id,
            'status': HealingStatus.RECOVERING.value,
            'recovery_started_at': now,
            'source_count': len(source_nodes),
            'best_source': {
                'hash_id': best_source['hash_id'],
                'layer': best_source['layer'],
                'trust_score': max_trust
            }
        }
    
    def verify_and_heal(self, hash_id: str) -> Dict:
        """3단계: 검증 및 치유 완료"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            SELECT healing_id FROM healing_records
            WHERE hash_id = ? AND status = ?
        """, (hash_id, HealingStatus.RECOVERING.value))
        
        healing_record = cursor.fetchone()
        if not healing_record:
            return {'error': 'Not in recovery'}
        
        healing_id = healing_record['healing_id']
        
        # 검증: 서명 확인
        from openhash.digital_signature import DigitalSignature
        ds = DigitalSignature()
        
        cursor.execute("""
            SELECT content_hash FROM openhash_records
            WHERE hash_id = ?
        """, (hash_id,))
        
        hash_record = cursor.fetchone()
        is_verified = ds.verify_signature(hash_id, hash_record['content_hash'])
        
        now = datetime.now().isoformat()
        
        if is_verified:
            cursor.execute("""
                UPDATE openhash_records
                SET quarantined = FALSE
                WHERE hash_id = ?
            """, (hash_id,))
            
            cursor.execute("""
                UPDATE healing_records
                SET verified_at = ?,
                    healed_at = ?,
                    status = ?,
                    verification_result = ?
                WHERE healing_id = ?
            """, (now, now, HealingStatus.HEALED.value, 'verified', healing_id))
            
            status = HealingStatus.HEALED.value
            message = 'Successfully healed'
        else:
            cursor.execute("""
                UPDATE healing_records
                SET verified_at = ?,
                    status = ?,
                    verification_result = ?
                WHERE healing_id = ?
            """, (now, HealingStatus.FAILED.value, 'verification_failed', healing_id))
            
            status = HealingStatus.FAILED.value
            message = 'Verification failed'
        
        self.conn.commit()
        
        return {
            'healing_id': healing_id,
            'hash_id': hash_id,
            'status': status,
            'verified_at': now,
            'healed_at': now if is_verified else None,
            'message': message
        }
    
    def heal_complete_workflow(self, hash_id: str) -> Dict:
        """전체 치유 워크플로우"""
        step1 = self.detect_and_quarantine(hash_id)
        if 'error' in step1 or step1.get('status') == 'clean':
            return step1
        
        step2 = self.recover_from_network(hash_id)
        if 'error' in step2 or step2.get('status') == HealingStatus.FAILED.value:
            return step2
        
        step3 = self.verify_and_heal(hash_id)
        
        return {
            'hash_id': hash_id,
            'workflow': 'complete',
            'steps': {
                'detection': step1,
                'recovery': step2,
                'verification': step3
            },
            'final_status': step3['status']
        }
    
    def get_healing_statistics(self) -> Dict:
        """치유 통계"""
        cursor = self.conn.cursor()
        
        cursor.execute("""
            SELECT status, COUNT(*) as count
            FROM healing_records
            GROUP BY status
        """)
        
        status_stats = {}
        for row in cursor.fetchall():
            status_stats[row['status']] = row['count']
        
        total = sum(status_stats.values())
        healed = status_stats.get(HealingStatus.HEALED.value, 0)
        failed = status_stats.get(HealingStatus.FAILED.value, 0)
        
        return {
            'total_healing_attempts': total,
            'healed_count': healed,
            'failed_count': failed,
            'success_rate': round(healed / total * 100, 2) if total > 0 else 0,
            'status_breakdown': status_stats
        }

if __name__ == '__main__':
    print("=== 선별적 치유 테스트 ===")
    print("")
    
    healer = HealingMechanism()
    
    import sqlite3
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT hash_id FROM openhash_records LIMIT 1")
    result = cursor.fetchone()
    
    if result:
        test_hash_id = result[0]
        
        print(f"테스트 해시: {test_hash_id}")
        print("")
        
        print("전체 치유 워크플로우 실행...")
        result = healer.heal_complete_workflow(test_hash_id)
        
        print(f"최종 상태: {result.get('final_status', result.get('status', 'N/A'))}")
        print("")
        
        stats = healer.get_healing_statistics()
        print("치유 통계:")
        print(f"  - 총 시도: {stats['total_healing_attempts']}")
        print(f"  - 성공: {stats['healed_count']}")
        print(f"  - 실패: {stats['failed_count']}")
        print(f"  - 성공률: {stats['success_rate']}%")
    else:
        print("테스트할 해시가 없습니다.")
    
    conn.close()
    print("")
    print("✅ 선별적 치유 테스트 완료!")
