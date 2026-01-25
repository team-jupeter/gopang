/**
 * Database Connection
 * Day 18-19: SQLite with better-sqlite3
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// 데이터 디렉토리 확인
const dataDir = process.env.DATA_DIR || '/gopang/data';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'gopang.db');
const db: any = new Database(dbPath);

// WAL 모드 활성화
db.pragma('journal_mode = WAL');

// 기본 테이블 생성
db.exec(`
  -- 사용자 테이블
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT,
    login_attempts INTEGER DEFAULT 0,
    locked_until TEXT
  );

  -- Vault 서랍 테이블
  CREATE TABLE IF NOT EXISTS vault_drawers (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    drawer_type TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, drawer_type)
  );

  -- Vault 항목 테이블
  CREATE TABLE IF NOT EXISTS vault_items (
    id TEXT PRIMARY KEY,
    drawer_id TEXT NOT NULL,
    title TEXT NOT NULL,
    data TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (drawer_id) REFERENCES vault_drawers(id)
  );

  -- 거래 테이블
  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'T',
    status TEXT NOT NULL,
    from_address TEXT,
    to_address TEXT,
    description TEXT,
    metadata TEXT,
    failure_reason TEXT,
    layer_verification TEXT,
    validation_result TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    verified_at TEXT,
    completed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- 대화 테이블
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  -- 메시지 테이블
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
  );

  -- 감사 로그 테이블
  CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    action TEXT NOT NULL,
    resource TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TEXT NOT NULL
  );
`);

console.log('✓ Database initialized:', dbPath);

export default db;
