/**
 * Admin 사용자 시드 스크립트
 * Kind E2E 테스트를 위해 admin 사용자를 데이터베이스에 생성합니다.
 * @libsql/client를 사용하여 앱과 동일한 방식으로 DB에 접근합니다.
 */
const { createClient } = require('@libsql/client');

const url = process.env.DATABASE_URL || 'file:./dev.db';
console.log('[seed] DATABASE_URL:', url);
const client = createClient({ url });

// Pre-computed bcrypt hash of 'adminpass123' (10 rounds)
const ADMIN_PASSWORD_HASH = '$2b$10$mH3ln54bjUEP.RzPZSUqeevObHNCbiIIes1QjBcq0p3LPZ6qIEBJC';

async function seed() {
  try {
    // Check existing tables
    const tables = await client.execute('SELECT name FROM sqlite_master WHERE type=\'table\'');
    console.log('[seed] Tables:', tables.rows.map(r => r.name));

    // Check if User table exists and its schema
    const userSchema = await client.execute('PRAGMA table_info(User)');
    console.log('[seed] User columns:', userSchema.rows.map(r => r.name));

    // Check existing users before insert
    const beforeCount = await client.execute('SELECT COUNT(*) as cnt FROM User');
    console.log('[seed] Users before insert:', beforeCount.rows[0].cnt);

    // Insert admin user
    const result = await client.execute({
      sql: 'INSERT OR IGNORE INTO User (id, username, passwordHash, displayName) VALUES (?, ?, ?, ?)',
      args: ['seed-admin-001', 'admin', ADMIN_PASSWORD_HASH, 'Admin User']
    });
    console.log('[seed] Insert result - rows affected:', result.rowsAffected);

    // Verify admin user exists
    const verify = await client.execute({
      sql: 'SELECT id, username, passwordHash IS NOT NULL as hasPassword, displayName FROM User WHERE username = ?',
      args: ['admin']
    });
    console.log('[seed] Verification - admin user:', JSON.stringify(verify.rows));

    // Count total users
    const afterCount = await client.execute('SELECT COUNT(*) as cnt FROM User');
    console.log('[seed] Users after insert:', afterCount.rows[0].cnt);

    console.log('Admin user seeded successfully');
  } catch (error) {
    console.error('[seed] Seed failed:', error);
    process.exit(1);
  }
}

seed();
