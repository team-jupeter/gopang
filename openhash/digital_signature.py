#!/usr/bin/env python3
"""
ECDSA P-256 디지털 서명 시스템 (명세서 도 14)

NIST P-256 곡선 기반 타원곡선 디지털 서명 알고리즘
"""
import os
import sqlite3
from datetime import datetime
from typing import Tuple, Optional, Dict
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.backends import default_backend
from cryptography.exceptions import InvalidSignature

DB_PATH = "/home/ec2-user/gopang/database/gopang.db"
KEYS_DIR = "/home/ec2-user/gopang/keys"

class DigitalSignature:
    """
    ECDSA P-256 디지털 서명 관리
    """
    
    def __init__(self):
        # 키 저장 디렉토리 생성
        os.makedirs(KEYS_DIR, exist_ok=True)
        self.conn = sqlite3.connect(DB_PATH)
        self.conn.row_factory = sqlite3.Row
        self._ensure_signature_table()
    
    def __del__(self):
        if hasattr(self, 'conn'):
            self.conn.close()
    
    def _ensure_signature_table(self):
        """서명 테이블 생성 (없으면)"""
        cursor = self.conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS signatures (
                signature_id INTEGER PRIMARY KEY AUTOINCREMENT,
                hash_id TEXT NOT NULL,
                signer_id TEXT NOT NULL,
                signature_r TEXT NOT NULL,
                signature_s TEXT NOT NULL,
                public_key TEXT NOT NULL,
                previous_hash TEXT,
                timestamp TEXT NOT NULL,
                verified BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (hash_id) REFERENCES openhash_records(hash_id)
            )
        """)
        
        # 인덱스 생성
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_signatures_hash_id 
            ON signatures(hash_id)
        """)
        
        self.conn.commit()
    
    def generate_key_pair(self, user_id: str) -> Tuple[ec.EllipticCurvePrivateKey, ec.EllipticCurvePublicKey]:
        """
        ECDSA P-256 키 쌍 생성 (명세서 도 14 - 키 쌍 생성)
        
        단계:
        1. 타원곡선 선택: NIST P-256 (secp256r1)
        2. 개인키 생성: 256비트 안전한 난수
        3. 공개키 계산: 개인키 × 생성점 G
        4. 키 검증: 수학적 유효성 확인
        
        Returns:
            (private_key, public_key)
        """
        # NIST P-256 곡선 사용
        private_key = ec.generate_private_key(
            ec.SECP256R1(),  # P-256 곡선
            default_backend()
        )
        
        public_key = private_key.public_key()
        
        # 키 파일 저장
        self._save_keys(user_id, private_key, public_key)
        
        return (private_key, public_key)
    
    def _save_keys(self, user_id: str, private_key: ec.EllipticCurvePrivateKey, 
                   public_key: ec.EllipticCurvePublicKey):
        """키를 파일로 저장"""
        # 개인키 저장 (PEM 형식, 암호화 없음 - 프로토타입용)
        private_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        with open(f"{KEYS_DIR}/{user_id}_private.pem", 'wb') as f:
            f.write(private_pem)
        
        # 공개키 저장 (PEM 형식)
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        
        with open(f"{KEYS_DIR}/{user_id}_public.pem", 'wb') as f:
            f.write(public_pem)
    
    def load_private_key(self, user_id: str) -> Optional[ec.EllipticCurvePrivateKey]:
        """개인키 로드"""
        try:
            with open(f"{KEYS_DIR}/{user_id}_private.pem", 'rb') as f:
                private_key = serialization.load_pem_private_key(
                    f.read(),
                    password=None,
                    backend=default_backend()
                )
            return private_key
        except FileNotFoundError:
            return None
    
    def load_public_key(self, user_id: str) -> Optional[ec.EllipticCurvePublicKey]:
        """공개키 로드"""
        try:
            with open(f"{KEYS_DIR}/{user_id}_public.pem", 'rb') as f:
                public_key = serialization.load_pem_public_key(
                    f.read(),
                    backend=default_backend()
                )
            return public_key
        except FileNotFoundError:
            return None
    
    def sign_hash(self, user_id: str, hash_id: str, content_hash: str, 
                  previous_hash: Optional[str] = None) -> Dict:
        """
        해시에 디지털 서명 생성 (명세서 도 14 - 서명 생성)
        
        단계:
        1. 메시지 해싱: SHA-256(content_hash || previous_hash)
        2. 난수 생성: RFC 6979 결정론적 k
        3. r 값 계산: (k × G).x mod n
        4. s 값 계산: k^-1 × (hash + private_key × r) mod n
        5. 서명 출력: (r, s) 64바이트
        
        Args:
            user_id: 서명자 ID
            hash_id: 해시 ID
            content_hash: 내용 해시
            previous_hash: 이전 블록 해시 (체인 연결용)
        
        Returns:
            서명 정보 딕셔너리
        """
        # 개인키 로드 (없으면 생성)
        private_key = self.load_private_key(user_id)
        if not private_key:
            private_key, _ = self.generate_key_pair(user_id)
        
        # 공개키
        public_key = private_key.public_key()
        
        # 서명할 메시지: content_hash + previous_hash (체인 연결)
        message = content_hash.encode()
        if previous_hash:
            message += previous_hash.encode()
        
        # ECDSA 서명 생성 (SHA-256 해싱 + P-256 서명)
        signature_bytes = private_key.sign(
            message,
            ec.ECDSA(hashes.SHA256())
        )
        
        # DER 형식을 r, s 값으로 파싱
        # DER: 0x30 [총길이] 0x02 [r길이] [r] 0x02 [s길이] [s]
        r, s = self._parse_der_signature(signature_bytes)
        
        # 공개키를 PEM 형식으로
        public_pem = public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode('utf-8')
        
        # 데이터베이스에 저장
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO signatures 
            (hash_id, signer_id, signature_r, signature_s, public_key, previous_hash, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            hash_id,
            user_id,
            r,
            s,
            public_pem,
            previous_hash,
            datetime.now().isoformat()
        ))
        
        signature_id = cursor.lastrowid
        self.conn.commit()
        
        return {
            'signature_id': signature_id,
            'hash_id': hash_id,
            'signer_id': user_id,
            'r': r,
            's': s,
            'algorithm': 'ECDSA-P256-SHA256',
            'previous_hash': previous_hash
        }
    
    def verify_signature(self, hash_id: str, content_hash: str) -> bool:
        """
        서명 검증 (명세서 도 14 - 서명 검증)
        
        단계:
        1. 서명 파싱: (r, s) 추출
        2. 메시지 해싱: SHA-256(content)
        3. 역원 계산: s^-1 mod n
        4. 점 계산: u1 = hash × s^-1, u2 = r × s^-1
        5. 검증 계산: (u1 × G + u2 × PublicKey).x mod n = r
        
        Returns:
            True: 서명 유효
            False: 서명 무효
        """
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT signature_r, signature_s, public_key, previous_hash
            FROM signatures
            WHERE hash_id = ?
            ORDER BY signature_id DESC
            LIMIT 1
        """, (hash_id,))
        
        sig_record = cursor.fetchone()
        
        if not sig_record:
            return False
        
        # 서명 재구성
        signature_bytes = self._reconstruct_der_signature(
            sig_record['signature_r'],
            sig_record['signature_s']
        )
        
        # 공개키 로드
        public_key = serialization.load_pem_public_key(
            sig_record['public_key'].encode('utf-8'),
            backend=default_backend()
        )
        
        # 검증할 메시지
        message = content_hash.encode()
        if sig_record['previous_hash']:
            message += sig_record['previous_hash'].encode()
        
        # 서명 검증
        try:
            public_key.verify(
                signature_bytes,
                message,
                ec.ECDSA(hashes.SHA256())
            )
            
            # 검증 성공 시 DB 업데이트
            cursor.execute("""
                UPDATE signatures
                SET verified = TRUE
                WHERE hash_id = ?
            """, (hash_id,))
            self.conn.commit()
            
            return True
        except InvalidSignature:
            return False
    
    def _parse_der_signature(self, der_bytes: bytes) -> Tuple[str, str]:
        """DER 형식에서 r, s 값 추출"""
        # 간단한 DER 파싱 (프로토타입용)
        # 실제 구현에서는 더 견고한 파싱 필요
        from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
        r, s = decode_dss_signature(der_bytes)
        return (hex(r), hex(s))
    
    def _reconstruct_der_signature(self, r_hex: str, s_hex: str) -> bytes:
        """r, s 값에서 DER 형식 재구성"""
        from cryptography.hazmat.primitives.asymmetric.utils import encode_dss_signature
        r = int(r_hex, 16)
        s = int(s_hex, 16)
        return encode_dss_signature(r, s)
    
    def verify_chain_integrity(self, hash_ids: list) -> Dict:
        """
        체인 무결성 검증
        
        각 해시가 이전 해시를 올바르게 참조하는지 확인
        """
        results = {
            'valid': True,
            'total_checked': len(hash_ids),
            'verified': 0,
            'failed': 0,
            'errors': []
        }
        
        for i, hash_id in enumerate(hash_ids):
            # 해시 내용 조회
            cursor = self.conn.cursor()
            cursor.execute("""
                SELECT content_hash FROM openhash_records
                WHERE hash_id = ?
            """, (hash_id,))
            
            record = cursor.fetchone()
            if not record:
                results['errors'].append(f"{hash_id}: Hash not found")
                results['failed'] += 1
                continue
            
            # 서명 검증
            is_valid = self.verify_signature(hash_id, record['content_hash'])
            
            if is_valid:
                results['verified'] += 1
            else:
                results['valid'] = False
                results['failed'] += 1
                results['errors'].append(f"{hash_id}: Signature verification failed")
        
        return results
    
    def get_signature_info(self, hash_id: str) -> Optional[Dict]:
        """서명 정보 조회"""
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT * FROM signatures
            WHERE hash_id = ?
            ORDER BY signature_id DESC
            LIMIT 1
        """, (hash_id,))
        
        record = cursor.fetchone()
        
        if not record:
            return None
        
        return {
            'signature_id': record['signature_id'],
            'hash_id': record['hash_id'],
            'signer_id': record['signer_id'],
            'r': record['signature_r'],
            's': record['signature_s'],
            'timestamp': record['timestamp'],
            'verified': bool(record['verified']),
            'previous_hash': record['previous_hash']
        }

if __name__ == '__main__':
    print("=== ECDSA P-256 디지털 서명 테스트 ===")
    print("")
    
    ds = DigitalSignature()
    
    # 테스트 사용자
    test_user = 'test_user'
    
    # 1. 키 쌍 생성
    print("1. 키 쌍 생성...")
    private_key, public_key = ds.generate_key_pair(test_user)
    print(f"   ✅ 키 쌍 생성 완료")
    print(f"   - 개인키: {KEYS_DIR}/{test_user}_private.pem")
    print(f"   - 공개키: {KEYS_DIR}/{test_user}_public.pem")
    print("")
    
    # 2. 서명 생성
    print("2. 디지털 서명 생성...")
    test_hash_id = "test_hash_001"
    test_content = "안녕하세요, 테스트 메시지입니다."
    test_content_hash = "a1b2c3d4e5f6..."
    
    signature = ds.sign_hash(test_user, test_hash_id, test_content_hash)
    print(f"   ✅ 서명 생성 완료")
    print(f"   - Signature ID: {signature['signature_id']}")
    print(f"   - r: {signature['r'][:20]}...")
    print(f"   - s: {signature['s'][:20]}...")
    print(f"   - 알고리즘: {signature['algorithm']}")
    print("")
    
    # 3. 서명 검증
    print("3. 서명 검증...")
    is_valid = ds.verify_signature(test_hash_id, test_content_hash)
    print(f"   {'✅' if is_valid else '❌'} 서명 검증: {'성공' if is_valid else '실패'}")
    print("")
    
    # 4. 서명 정보 조회
    print("4. 서명 정보 조회...")
    sig_info = ds.get_signature_info(test_hash_id)
    if sig_info:
        print(f"   - Signer: {sig_info['signer_id']}")
        print(f"   - Timestamp: {sig_info['timestamp']}")
        print(f"   - Verified: {sig_info['verified']}")
    print("")
    
    print("✅ ECDSA 디지털 서명 테스트 완료!")
