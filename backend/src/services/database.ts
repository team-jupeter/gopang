/**
 * SQLite 데이터베이스 연결 및 스키마
 * Day 8: 8개 테이블, WAL 모드
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

let db: Database.Database | null = null;

/**
 * 데이터베이스 연결 초기화
 */
export function initDatabase(dbPath: string): Database.Database {
  if (db) return db;

  // 디렉토리 확인
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  console.log(`[DB] Connecting to: ${dbPath}`);
  db = new Database(dbPath);

  // WAL 모드 활성화
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('cache_size = -64000');
  db.pragma('temp_store = MEMORY');

  console.log('[DB] WAL mode enabled');

  // 테이블 생성
  createTables(db);

  return db;
}

/**
 * 8개 테이블 생성
 */
function createTables(database: Database.Database): void {
  // 1. users
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      user_type TEXT NOT NULL CHECK (user_type IN ('human', 'ai', 'business')),
      email TEXT UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      region_code TEXT,
      egct_balance REAL DEFAULT 0,
      system_prompt TEXT,
      login_attempts INTEGER DEFAULT 0,
      locked_until TEXT,
      refresh_token TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 2. gopang_ais
  database.exec(`
    CREATE TABLE IF NOT EXISTS gopang_ais (
      id TEXT PRIMARY KEY,
      ai_type TEXT NOT NULL CHECK (ai_type IN ('government', 'business', 'personal_assistant')),
      name TEXT NOT NULL,
      organization TEXT,
      jurisdiction TEXT,
      layer INTEGER CHECK (layer BETWEEN 1 AND 4),
      system_prompt TEXT NOT NULL,
      capabilities TEXT,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 3. vaults
  database.exec(`
    CREATE TABLE IF NOT EXISTS vaults (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id),
      encryption_key_hash TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id)
    )
  `);

  // 4. vault_drawers
  database.exec(`
    CREATE TABLE IF NOT EXISTS vault_drawers (
      id TEXT PRIMARY KEY,
      vault_id TEXT NOT NULL REFERENCES vaults(id),
      drawer_type TEXT NOT NULL CHECK (
        drawer_type IN ('FINANCE', 'MEDICAL', 'EDUCATION', 'ADMIN', 'TRANSPORT', 'GENERAL')
      ),
      content TEXT NOT NULL,
      metadata TEXT,
      openhash_value TEXT,
      storage_layer INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 5. conversations
  database.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      participants TEXT NOT NULL,
      title TEXT,
      openhash_value TEXT,
      storage_layer INTEGER CHECK (storage_layer BETWEEN 1 AND 4),
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 6. messages
  database.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id),
      sender_id TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      message_type TEXT DEFAULT 'text' CHECK (
        message_type IN ('text', 'system', 'ai_response', 'transaction', 'handshake')
      ),
      metadata TEXT,
      openhash_value TEXT,
      status TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'read', 'failed')),
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 7. transactions
  database.exec(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL REFERENCES users(id),
      receiver_id TEXT NOT NULL REFERENCES users(id),
      amount REAL NOT NULL CHECK (amount > 0),
      currency TEXT DEFAULT 'EGCT',
      category TEXT,
      description TEXT,
      status TEXT DEFAULT 'pending' CHECK (
        status IN ('pending', 'verified', 'completed', 'failed', 'cancelled')
      ),
      verification_steps TEXT,
      failure_reason TEXT,
      blockchain_hash TEXT,
      openhash_layer INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT
    )
  `);

  // 8. audit_logs
  database.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT REFERENCES users(id),
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      request_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // 인덱스 생성
  createIndexes(database);

  console.log('[DB] 8 tables created');
}

/**
 * 인덱스 생성
 */
function createIndexes(database: Database.Database): void {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
    'CREATE INDEX IF NOT EXISTS idx_users_type ON users(user_type)',
    'CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_sender ON transactions(sender_id)',
    'CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)',
    'CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC)',
  ];

  for (const sql of indexes) {
    database.exec(sql);
  }
  console.log('[DB] Indexes created');
}

/**
 * 데이터베이스 인스턴스 조회
 */
export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

/**
 * 데이터베이스 종료
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    console.log('[DB] Connection closed');
  }
}

export default { initDatabase, getDatabase, closeDatabase };
