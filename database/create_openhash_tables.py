#!/usr/bin/env python3
"""
OpenHash 데이터베이스 스키마 생성
"""
import sqlite3

DB_PATH = "/home/ec2-user/gopang/database/gopang.db"

def create_openhash_tables():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # AI 사용자 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS ai_users (
        ai_id TEXT PRIMARY KEY,
        ai_name TEXT NOT NULL,
        ai_type TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        owner_id TEXT,
        region_code TEXT,
        layer INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (owner_id) REFERENCES users(user_id)
    )
    ''')
    
    # OpenHash 레코드 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS openhash_records (
        hash_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        layer INTEGER NOT NULL,
        transmitted BOOLEAN DEFAULT FALSE,
        transmitted_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(user_id)
    )
    ''')
    
    # Layer 저장소 테이블
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS layer_storage (
        storage_id INTEGER PRIMARY KEY AUTOINCREMENT,
        hash_id TEXT NOT NULL,
        layer INTEGER NOT NULL,
        ai_id TEXT NOT NULL,
        stored_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (hash_id) REFERENCES openhash_records(hash_id),
        FOREIGN KEY (ai_id) REFERENCES ai_users(ai_id)
    )
    ''')
    
    print("✅ OpenHash 테이블 생성 완료")
    
    # 테스트 AI 사용자 데이터 삽입
    ai_users_data = [
        # Layer 4 - 국가 AI
        ('ai_01', '국세청', 'institution', '당신은 대한민국 국세청 AI입니다. 세금 관련 업무를 처리합니다. 한국어로만 답변하세요.', None, '50', 4),
        ('ai_02', '건강보험공단', 'institution', '당신은 국민건강보험공단 AI입니다. 건강보험 업무를 처리합니다. 한국어로만 답변하세요.', None, '50', 4),
        ('ai_03', '법원', 'institution', '당신은 법원 AI입니다. 법률 관련 업무를 처리합니다. 한국어로만 답변하세요.', None, '50', 4),
        ('ai_04', '특허청', 'institution', '당신은 특허청 AI입니다. 특허 및 지적재산권 업무를 처리합니다. 한국어로만 답변하세요.', None, '50', 4),
        
        # Layer 3 - 광역시도 AI
        ('ai_09', '제주특별자치도청', 'institution', '당신은 제주특별자치도청 AI입니다. 제주도 행정 업무를 처리합니다. 한국어로만 답변하세요.', None, '50', 3),
        
        # Layer 2 - 시군구 AI
        ('ai_07', '제주시청', 'institution', '당신은 제주시청 AI입니다. 제주시 행정 업무를 처리합니다. 한국어로만 답변하세요.', None, '5011', 2),
        ('ai_08', '서귀포시청', 'institution', '당신은 서귀포시청 AI입니다. 서귀포시 행정 업무를 처리합니다. 한국어로만 답변하세요.', None, '5013', 2),
        
        # Layer 1 - 읍면동 AI
        ('ai_06', '한림읍행정복지센터', 'institution', '당신은 한림읍 행정복지센터 AI입니다. 한림읍 주민 서비스를 제공합니다. 한국어로만 답변하세요.', None, '5011025000', 1),
        ('ai_11', '노형동행정복지센터', 'institution', '당신은 노형동 행정복지센터 AI입니다. 노형동 주민 서비스를 제공합니다. 한국어로만 답변하세요.', None, '5011010600', 1),
        ('ai_05', '중앙동행정복지센터', 'institution', '당신은 중앙동 행정복지센터 AI입니다. 중앙동 주민 서비스를 제공합니다. 한국어로만 답변하세요.', None, '5013052000', 1),
        ('ai_10', '안덕면행정복지센터', 'institution', '당신은 안덕면 행정복지센터 AI입니다. 안덕면 주민 서비스를 제공합니다. 한국어로만 답변하세요.', None, '5013077000', 1),
        
        # 병원 AI
        ('ai_12', '제주대학교병원', 'institution', '당신은 제주대학교병원 AI입니다. 의료 상담 및 예약 업무를 처리합니다. 한국어로만 답변하세요.', None, '5011', 2),
    ]
    
    for ai_data in ai_users_data:
        try:
            cursor.execute('''
                INSERT OR IGNORE INTO ai_users 
                (ai_id, ai_name, ai_type, system_prompt, owner_id, region_code, layer)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', ai_data)
        except Exception as e:
            print(f"AI 사용자 삽입 실패: {ai_data[0]} - {e}")
    
    conn.commit()
    
    # 생성된 테이블 확인
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print("\n=== 데이터베이스 테이블 목록 ===")
    for table in tables:
        print(f"  - {table[0]}")
    
    # AI 사용자 수 확인
    cursor.execute("SELECT COUNT(*) FROM ai_users")
    ai_count = cursor.fetchone()[0]
    print(f"\n✅ AI 사용자: {ai_count}개 등록")
    
    # AI 목록 출력
    cursor.execute("SELECT ai_id, ai_name, layer FROM ai_users ORDER BY layer DESC, ai_name")
    print("\n=== AI 사용자 목록 ===")
    for ai in cursor.fetchall():
        print(f"  Layer {ai[2]}: {ai[0]} - {ai[1]}")
    
    conn.close()

if __name__ == '__main__':
    create_openhash_tables()
