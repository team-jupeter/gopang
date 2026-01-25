import { initDatabase, getDatabase, closeDatabase } from './src/services/database';

const dbPath = '/gopang/data/db/gopang.db';

console.log('=== DB 초기화 테스트 ===');
const db = initDatabase(dbPath);

// 테이블 확인
const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all();
console.log('\n생성된 테이블:');
tables.forEach((t: any) => console.log(`  - ${t.name}`));

// WAL 모드 확인
const journalMode = db.prepare("PRAGMA journal_mode").get();
console.log(`\nJournal Mode: ${(journalMode as any).journal_mode}`);

closeDatabase();
console.log('\n✓ 테스트 완료');
