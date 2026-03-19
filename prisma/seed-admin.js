/**
 * Admin 사용자 시드 스크립트
 * Kind E2E 테스트를 위해 admin 사용자를 데이터베이스에 생성합니다.
 * @libsql/client를 사용하여 앱과 동일한 방식으로 DB에 접근합니다.
 */
const { createClient } = require('@libsql/client');

const url = process.env.DATABASE_URL || 'file:./dev.db';
const client = createClient({ url });

// Pre-computed bcrypt hash of 'adminpass123' (10 rounds)
const ADMIN_PASSWORD_HASH = '$2b$10$mH3ln54bjUEP.RzPZSUqeevObHNCbiIIes1QjBcq0p3LPZ6qIEBJC';

async function seed() {
  try {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO User (id, username, passwordHash, displayName) VALUES (?, ?, ?, ?)',
      args: ['seed-admin-001', 'admin', ADMIN_PASSWORD_HASH, 'Admin User']
    });
    console.log('Admin user seeded successfully');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  }
}

seed();
