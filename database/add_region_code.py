#!/usr/bin/env python3
"""
users 테이블에 region_code 컬럼 추가
"""
import sqlite3

DB_PATH = "/home/ec2-user/gopang/database/gopang.db"

def add_region_code_column():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # 기존 컬럼 확인
    cursor.execute("PRAGMA table_info(users)")
    columns = [row[1] for row in cursor.fetchall()]
    
    print("=== 현재 users 테이블 컬럼 ===")
    for col in columns:
        print(f"  - {col}")
    
    # region_code 컬럼 추가
    if 'region_code' not in columns:
        print("\n=== region_code 컬럼 추가 ===")
        cursor.execute('''
            ALTER TABLE users 
            ADD COLUMN region_code TEXT DEFAULT '5011025000'
        ''')
        print("✅ region_code 컬럼 추가 완료 (기본값: 한림읍)")
    else:
        print("\n✅ region_code 컬럼이 이미 존재합니다.")
    
    # 테스트 사용자에게 지역 코드 할당
    cursor.execute('''
        UPDATE users 
        SET region_code = '5011025000' 
        WHERE user_id = 'test_user'
    ''')
    
    conn.commit()
    
    # 업데이트 확인
    cursor.execute("SELECT user_id, name, region_code FROM users")
    print("\n=== 사용자 목록 ===")
    for row in cursor.fetchall():
        print(f"  {row[0]}: {row[1]} - 지역코드: {row[2]}")
    
    conn.close()

if __name__ == '__main__':
    add_region_code_column()
