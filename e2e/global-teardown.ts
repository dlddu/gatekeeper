import path from 'path';
import fs from 'fs';
import { stopOidcMockServer } from './helpers/oidc-mock';

/**
 * Playwright 글로벌 티어다운 (모든 테스트 완료 후 1회)
 *
 * DLD-647: e2e 테스트 환경 구성
 *
 * 수행 작업:
 * 1. 테스트 전용 SQLite DB 파일 삭제
 * 2. 관련 임시 파일 정리
 */

const testDBPath = path.resolve(__dirname, '..', 'e2e-test.db');

async function globalTeardown(): Promise<void> {
  console.log('\n[E2E Teardown] 테스트 환경 정리 시작...');

  // OIDC Mock 서버 종료 (실패해도 나머지 정리 작업은 계속 진행)
  try {
    await stopOidcMockServer();
    console.log('[E2E Teardown] OIDC Mock 서버 종료 완료');
  } catch (e) {
    console.error('[E2E Teardown] OIDC Mock 서버 종료 실패 (계속 진행):', e);
  }

  // 테스트 DB 삭제
  if (fs.existsSync(testDBPath)) {
    fs.unlinkSync(testDBPath);
    console.log('[E2E Teardown] 테스트 DB 삭제 완료');
  }

  // WAL(Write-Ahead Log) 파일도 존재할 경우 삭제
  const walPath = `${testDBPath}-wal`;
  if (fs.existsSync(walPath)) {
    fs.unlinkSync(walPath);
    console.log('[E2E Teardown] WAL 파일 삭제 완료');
  }

  // SHM(Shared Memory) 파일도 존재할 경우 삭제
  const shmPath = `${testDBPath}-shm`;
  if (fs.existsSync(shmPath)) {
    fs.unlinkSync(shmPath);
    console.log('[E2E Teardown] SHM 파일 삭제 완료');
  }

  console.log('[E2E Teardown] 테스트 환경 정리 완료\n');
}

export default globalTeardown;
