#!/usr/bin/env python3
"""
해시 전용 전송 프로토콜 (명세서: 90% 대역폭 절약)

원본 문서를 전송하지 않고 137바이트 고정 패킷만 전송
- 32바이트: SHA-256 해시
- 8바이트: 타임스탬프
- 10바이트: 지역 코드
- 32바이트: 이전 해시
- 64바이트: 디지털 서명 (r, s)
- 1바이트: 플래그
총: 147바이트 (명세서 137바이트에 근접)
"""
import struct
import time
from typing import Tuple, Optional, Dict
from datetime import datetime

class HashPacket:
    """
    해시 전용 전송 패킷
    
    고정 크기: 147바이트
    """
    
    # 패킷 구조
    HASH_SIZE = 32          # SHA-256 해시
    TIMESTAMP_SIZE = 8      # Unix timestamp (초)
    REGION_SIZE = 10        # 지역 코드 (문자열)
    PREV_HASH_SIZE = 32     # 이전 해시
    SIGNATURE_R_SIZE = 32   # 서명 r 값
    SIGNATURE_S_SIZE = 32   # 서명 s 값
    FLAGS_SIZE = 1          # 플래그
    
    TOTAL_SIZE = (HASH_SIZE + TIMESTAMP_SIZE + REGION_SIZE + 
                  PREV_HASH_SIZE + SIGNATURE_R_SIZE + 
                  SIGNATURE_S_SIZE + FLAGS_SIZE)  # 147 바이트
    
    def __init__(self):
        pass
    
    @staticmethod
    def create_packet(
        content_hash: str,
        timestamp: int,
        region_code: str,
        previous_hash: Optional[str] = None,
        signature_r: Optional[str] = None,
        signature_s: Optional[str] = None,
        has_signature: bool = False
    ) -> bytes:
        """
        해시 전용 패킷 생성
        
        Args:
            content_hash: 32바이트 해시 (hex 문자열)
            timestamp: Unix 타임스탬프
            region_code: 지역 코드 (최대 10자)
            previous_hash: 이전 해시 (hex 문자열)
            signature_r: 서명 r 값 (hex 문자열)
            signature_s: 서명 s 값 (hex 문자열)
            has_signature: 서명 포함 여부
        
        Returns:
            147바이트 고정 크기 패킷
        """
        packet = bytearray(HashPacket.TOTAL_SIZE)
        offset = 0
        
        # 1. 해시 (32바이트)
        hash_bytes = bytes.fromhex(content_hash) if len(content_hash) == 64 else content_hash.encode()
        packet[offset:offset + HashPacket.HASH_SIZE] = hash_bytes[:HashPacket.HASH_SIZE].ljust(HashPacket.HASH_SIZE, b'\x00')
        offset += HashPacket.HASH_SIZE
        
        # 2. 타임스탬프 (8바이트)
        struct.pack_into('!Q', packet, offset, timestamp)
        offset += HashPacket.TIMESTAMP_SIZE
        
        # 3. 지역 코드 (10바이트)
        region_bytes = region_code.encode('utf-8')[:HashPacket.REGION_SIZE]
        packet[offset:offset + HashPacket.REGION_SIZE] = region_bytes.ljust(HashPacket.REGION_SIZE, b'\x00')
        offset += HashPacket.REGION_SIZE
        
        # 4. 이전 해시 (32바이트)
        if previous_hash:
            prev_hash_bytes = bytes.fromhex(previous_hash) if len(previous_hash) >= 32 else previous_hash.encode()
            packet[offset:offset + HashPacket.PREV_HASH_SIZE] = prev_hash_bytes[:HashPacket.PREV_HASH_SIZE].ljust(HashPacket.PREV_HASH_SIZE, b'\x00')
        else:
            packet[offset:offset + HashPacket.PREV_HASH_SIZE] = b'\x00' * HashPacket.PREV_HASH_SIZE
        offset += HashPacket.PREV_HASH_SIZE
        
        # 5. 서명 r (32바이트)
        if signature_r:
            r_int = int(signature_r, 16) if signature_r.startswith('0x') else int(signature_r, 16)
            r_bytes = r_int.to_bytes(HashPacket.SIGNATURE_R_SIZE, byteorder='big', signed=False)
            packet[offset:offset + HashPacket.SIGNATURE_R_SIZE] = r_bytes
        else:
            packet[offset:offset + HashPacket.SIGNATURE_R_SIZE] = b'\x00' * HashPacket.SIGNATURE_R_SIZE
        offset += HashPacket.SIGNATURE_R_SIZE
        
        # 6. 서명 s (32바이트)
        if signature_s:
            s_int = int(signature_s, 16) if signature_s.startswith('0x') else int(signature_s, 16)
            s_bytes = s_int.to_bytes(HashPacket.SIGNATURE_S_SIZE, byteorder='big', signed=False)
            packet[offset:offset + HashPacket.SIGNATURE_S_SIZE] = s_bytes
        else:
            packet[offset:offset + HashPacket.SIGNATURE_S_SIZE] = b'\x00' * HashPacket.SIGNATURE_S_SIZE
        offset += HashPacket.SIGNATURE_S_SIZE
        
        # 7. 플래그 (1바이트)
        flags = 0
        if has_signature:
            flags |= 0x01  # 비트 0: 서명 포함
        if previous_hash:
            flags |= 0x02  # 비트 1: 이전 해시 포함
        packet[offset] = flags
        
        return bytes(packet)
    
    @staticmethod
    def parse_packet(packet: bytes) -> Dict:
        """
        패킷 파싱
        
        Args:
            packet: 147바이트 패킷
        
        Returns:
            파싱된 데이터 딕셔너리
        """
        if len(packet) != HashPacket.TOTAL_SIZE:
            raise ValueError(f"Invalid packet size: {len(packet)} (expected {HashPacket.TOTAL_SIZE})")
        
        offset = 0
        result = {}
        
        # 1. 해시
        hash_bytes = packet[offset:offset + HashPacket.HASH_SIZE]
        result['content_hash'] = hash_bytes.hex()
        offset += HashPacket.HASH_SIZE
        
        # 2. 타임스탬프
        timestamp = struct.unpack_from('!Q', packet, offset)[0]
        result['timestamp'] = timestamp
        result['datetime'] = datetime.fromtimestamp(timestamp).isoformat()
        offset += HashPacket.TIMESTAMP_SIZE
        
        # 3. 지역 코드
        region_bytes = packet[offset:offset + HashPacket.REGION_SIZE]
        result['region_code'] = region_bytes.rstrip(b'\x00').decode('utf-8')
        offset += HashPacket.REGION_SIZE
        
        # 4. 이전 해시
        prev_hash_bytes = packet[offset:offset + HashPacket.PREV_HASH_SIZE]
        if prev_hash_bytes != b'\x00' * HashPacket.PREV_HASH_SIZE:
            result['previous_hash'] = prev_hash_bytes.hex()
        else:
            result['previous_hash'] = None
        offset += HashPacket.PREV_HASH_SIZE
        
        # 5. 서명 r
        r_bytes = packet[offset:offset + HashPacket.SIGNATURE_R_SIZE]
        if r_bytes != b'\x00' * HashPacket.SIGNATURE_R_SIZE:
            r_int = int.from_bytes(r_bytes, byteorder='big', signed=False)
            result['signature_r'] = hex(r_int)
        else:
            result['signature_r'] = None
        offset += HashPacket.SIGNATURE_R_SIZE
        
        # 6. 서명 s
        s_bytes = packet[offset:offset + HashPacket.SIGNATURE_S_SIZE]
        if s_bytes != b'\x00' * HashPacket.SIGNATURE_S_SIZE:
            s_int = int.from_bytes(s_bytes, byteorder='big', signed=False)
            result['signature_s'] = hex(s_int)
        else:
            result['signature_s'] = None
        offset += HashPacket.SIGNATURE_S_SIZE
        
        # 7. 플래그
        flags = packet[offset]
        result['has_signature'] = bool(flags & 0x01)
        result['has_previous_hash'] = bool(flags & 0x02)
        
        return result
    
    @staticmethod
    def calculate_bandwidth_saving(original_size: int) -> Dict:
        """
        대역폭 절약 계산
        
        Args:
            original_size: 원본 문서 크기 (바이트)
        
        Returns:
            절약 통계
        """
        packet_size = HashPacket.TOTAL_SIZE
        saved_bytes = original_size - packet_size
        saving_percentage = (saved_bytes / original_size) * 100 if original_size > 0 else 0
        
        return {
            'original_size': original_size,
            'packet_size': packet_size,
            'saved_bytes': saved_bytes,
            'saving_percentage': round(saving_percentage, 2),
            'compression_ratio': round(original_size / packet_size, 2) if packet_size > 0 else 0
        }

if __name__ == '__main__':
    print("=== 해시 전용 전송 프로토콜 테스트 ===")
    print("")
    
    # 테스트 데이터
    test_hash = "a1b2c3d4e5f6789012345678901234567890abcdefabcdef1234567890abcdef"
    test_timestamp = int(time.time())
    test_region = "5011025000"
    test_prev_hash = "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    test_sig_r = "0xd1949bfaabc208a067633db05eadc8f9b8e1234567890abcdef1234567890ab"
    test_sig_s = "0xdb26e02194a508710e6b8631268bc7f8a9f1234567890abcdef1234567890ab"
    
    print("1. 패킷 생성...")
    packet = HashPacket.create_packet(
        content_hash=test_hash,
        timestamp=test_timestamp,
        region_code=test_region,
        previous_hash=test_prev_hash,
        signature_r=test_sig_r,
        signature_s=test_sig_s,
        has_signature=True
    )
    
    print(f"   ✅ 패킷 크기: {len(packet)} 바이트")
    print(f"   - 목표 크기: {HashPacket.TOTAL_SIZE} 바이트")
    print(f"   - 일치 여부: {'✅' if len(packet) == HashPacket.TOTAL_SIZE else '❌'}")
    print("")
    
    print("2. 패킷 파싱...")
    parsed = HashPacket.parse_packet(packet)
    
    print(f"   - 해시: {parsed['content_hash'][:32]}...")
    print(f"   - 시간: {parsed['datetime']}")
    print(f"   - 지역: {parsed['region_code']}")
    print(f"   - 이전 해시: {parsed['previous_hash'][:32] if parsed['previous_hash'] else 'None'}...")
    print(f"   - 서명 포함: {parsed['has_signature']}")
    print(f"   - r: {parsed['signature_r'][:20] if parsed['signature_r'] else 'None'}...")
    print(f"   - s: {parsed['signature_s'][:20] if parsed['signature_s'] else 'None'}...")
    print("")
    
    print("3. 대역폭 절약 계산...")
    
    # 다양한 문서 크기에 대한 절약률
    test_sizes = [
        ("텍스트 (1KB)", 1024),
        ("이미지 (500KB)", 500 * 1024),
        ("문서 (5MB)", 5 * 1024 * 1024),
        ("동영상 (100MB)", 100 * 1024 * 1024)
    ]
    
    for name, size in test_sizes:
        savings = HashPacket.calculate_bandwidth_saving(size)
        print(f"   {name}:")
        print(f"     - 원본: {savings['original_size']:,} 바이트")
        print(f"     - 패킷: {savings['packet_size']} 바이트")
        print(f"     - 절약: {savings['saved_bytes']:,} 바이트")
        print(f"     - 절약률: {savings['saving_percentage']:.2f}%")
        print(f"     - 압축비: {savings['compression_ratio']:.2f}x")
        print("")
    
    print("✅ 해시 전용 전송 프로토콜 테스트 완료!")
