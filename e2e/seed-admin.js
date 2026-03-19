/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Admin 사용자 시드 스크립트
 * Kind E2E 테스트를 위해 admin 사용자를 데이터베이스에 생성합니다.
 * @libsql/client를 사용하여 앱과 동일한 방식으로 DB에 접근합니다.
 *
 * 자격 증명은 e2e/helpers/auth.ts의 TEST_USERS.admin과 일치해야 합니다.
 */
const { createClient } = require('@libsql/client');

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_AUTHENTIK_UID = process.env.ADMIN_AUTHENTIK_UID || 'e2e-admin-uid-001';

const url = process.env.DATABASE_URL || 'file:./dev.db';
const client = createClient({ url });

async function seed() {
  try {
    const now = new Date().toISOString();
    const result = await client.execute({
      sql: 'INSERT OR IGNORE INTO User (id, username, authentikUid, displayName, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
      args: ['seed-admin-001', ADMIN_USERNAME, ADMIN_AUTHENTIK_UID, 'Admin User', now, now]
    });
    console.log(`[seed] Admin user seeded (rows affected: ${result.rowsAffected})`);
  } catch (error) {
    console.error('[seed] Seed failed:', error);
    process.exit(1);
  }
}

seed();
