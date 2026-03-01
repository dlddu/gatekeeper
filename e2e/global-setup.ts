import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

/**
 * Playwright 글로벌 셋업 (모든 테스트 실행 전 1회)
 *
 * DLD-647: e2e 테스트 환경 구성
 *
 * 수행 작업:
 * 1. 테스트 전용 SQLite DB 파일 생성
 * 2. Prisma 마이그레이션 적용
 * 3. 시드 데이터 삽입 (테스트 사용자, 샘플 Request)
 */

const testDBPath = path.resolve(__dirname, '..', 'e2e-test.db');
const testDBUrl = `file:${testDBPath}`;

async function globalSetup(): Promise<void> {
  console.log('\n[E2E Setup] 테스트용 DB 초기화 시작...');

  // 이전 테스트 DB가 남아 있으면 삭제
  if (fs.existsSync(testDBPath)) {
    fs.unlinkSync(testDBPath);
    console.log('[E2E Setup] 기존 테스트 DB 삭제 완료');
  }

  // Prisma 스키마를 DB에 직접 반영 (migrations 디렉토리 불필요)
  console.log('[E2E Setup] Prisma db push 실행 중...');
  try {
    execSync('npx prisma db push --skip-generate --accept-data-loss', {
      cwd: path.resolve(__dirname, '..'),
      env: {
        ...process.env,
        DATABASE_URL: testDBUrl,
      },
      stdio: 'inherit',
    });
    console.log('[E2E Setup] Prisma db push 완료');
  } catch (error) {
    console.error('[E2E Setup] Prisma db push 실패:', error);
    throw error;
  }

  // 시드 데이터 삽입
  console.log('[E2E Setup] 시드 데이터 삽입 중...');
  await seedDatabase(testDBUrl);
  console.log('[E2E Setup] 시드 데이터 삽입 완료');

  console.log('[E2E Setup] 테스트 환경 준비 완료\n');
}

async function seedDatabase(databaseUrl: string): Promise<void> {
  // 동적 import로 Prisma 클라이언트 생성 (테스트 DB URL 사용)
  const { PrismaClient } = await import('@prisma/client');
  const { PrismaLibSql } = await import('@prisma/adapter-libsql');
  const bcrypt = await import('bcryptjs');

  const adapter = new PrismaLibSql({ url: databaseUrl });
  const prisma = new PrismaClient({ adapter });

  try {
    // 테스트 관리자 사용자 생성
    const adminPasswordHash = await bcrypt.hash('adminpass123', 10);
    await prisma.user.upsert({
      where: { username: 'admin' },
      update: {},
      create: {
        username: 'admin',
        passwordHash: adminPasswordHash,
        displayName: 'E2E Test Admin',
      },
    });

    // 일반 테스트 사용자 생성
    const userPasswordHash = await bcrypt.hash('userpass123', 10);
    await prisma.user.upsert({
      where: { username: 'testuser' },
      update: {},
      create: {
        username: 'testuser',
        passwordHash: userPasswordHash,
        displayName: 'E2E Test User',
      },
    });

    // 샘플 PENDING Request 생성
    await prisma.request.upsert({
      where: { externalId: 'e2e-pending-001' },
      update: {},
      create: {
        externalId: 'e2e-pending-001',
        context: 'E2E 테스트용 PENDING 요청입니다.',
        requesterName: 'E2E Test Requester',
        status: 'PENDING',
      },
    });

    // 샘플 APPROVED Request 생성
    const admin = await prisma.user.findUnique({ where: { username: 'admin' } });
    if (admin) {
      await prisma.request.upsert({
        where: { externalId: 'e2e-approved-001' },
        update: {},
        create: {
          externalId: 'e2e-approved-001',
          context: 'E2E 테스트용 이미 승인된 요청입니다.',
          requesterName: 'E2E Test Requester',
          status: 'APPROVED',
          processedAt: new Date(),
          processedById: admin.id,
        },
      });
    }

    // 샘플 REJECTED Request 생성
    await prisma.request.upsert({
      where: { externalId: 'e2e-rejected-001' },
      update: {},
      create: {
        externalId: 'e2e-rejected-001',
        context: 'E2E 테스트용 거절된 요청입니다.',
        requesterName: 'E2E Test Requester',
        status: 'REJECTED',
      },
    });

    // 타임아웃이 있는 PENDING Request 생성
    await prisma.request.upsert({
      where: { externalId: 'e2e-timeout-001' },
      update: {},
      create: {
        externalId: 'e2e-timeout-001',
        context: 'E2E 테스트용 타임아웃 요청입니다.',
        requesterName: 'E2E Timeout Requester',
        status: 'PENDING',
        timeoutSeconds: 300,
      },
    });
  } finally {
    await prisma.$disconnect();
  }
}

export default globalSetup;
