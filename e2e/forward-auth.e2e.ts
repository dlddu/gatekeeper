import { test, expect } from '@playwright/test';
import { withAuthHeader, TEST_USERS } from './helpers/auth';
import { findUserByUsername, deleteTestUser } from './helpers/db';

/**
 * Forward Auth 사용자 식별 E2E 테스트
 *
 * DLD-830: 작업 2-2: [Forward Auth 사용자 식별] 구현 완료
 * 부모 이슈: DLD-645 (Gatekeeper — 승인 게이트웨이 서비스)
 *
 * 커버리지:
 * - GET /api/me (Forward Auth 헤더 기반 사용자 식별)
 * - auto-provisioning: 최초 요청 시 사용자 자동 생성
 * - 기존 사용자 재요청 시 동일 사용자 반환
 * - Remote-Email 변경 시 email 필드 업데이트
 */

test.describe('GET /api/me (Forward Auth 사용자 식별)', () => {
  test('Forward Auth 헤더 포함 요청 시 200과 사용자 정보를 반환한다 (happy path)', async ({
    request,
  }) => {
    // Global setup에서 미리 생성된 admin 사용�� 활용
    const response = await request.get('/api/me', {
      ...withAuthHeader(
        TEST_USERS.admin.autheliaId,
        TEST_USERS.admin.username,
        TEST_USERS.admin.email
      ),
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty('id');
    expect(body.username).toBe(TEST_USERS.admin.username);
    expect(body.autheliaId).toBe(TEST_USERS.admin.autheliaId);
  });

  test('Forward Auth 헤더 없이 요청 시 401을 반환한다 (error case)', async ({ request }) => {
    const response = await request.get('/api/me');

    expect(response.status()).toBe(401);
  });

  test('최초 요청 시 DB에 사용자가 자동 생성된다 (auto-provisioning, happy path)', async ({
    request,
  }) => {
    const newUser = {
      autheliaId: 'e2e-autoprov-uid-001',
      username: 'e2e-autoprov-user',
      email: 'autoprov@example.com',
      displayName: 'E2E Auto Provisioned User',
    };

    // 테스트 전 혹시 남아 있을 수 있는 잔여 데이터 정리
    await deleteTestUser(newUser.username);

    try {
      // GET /api/me 요청 — 이 사용자는 DB에 존재하지 않으므로 auto-provisioning 발생해야 함
      const response = await request.get('/api/me', {
        headers: {
          'Remote-User': newUser.autheliaId,
          'Remote-Email': newUser.email,
          'Remote-Name': newUser.displayName,
        },
      });

      expect(response.status()).toBe(200);

      // DB에서 사용자가 실제로 생성되었는지 직접 조회로 검증
      const createdUser = await findUserByUsername(newUser.autheliaId);
      expect(createdUser).not.toBeNull();
      expect(createdUser!.id).toBeTruthy();
    } finally {
      // cleanup: 테스트에서 생성한 사용자 삭제
      await deleteTestUser(newUser.autheliaId);
    }
  });

  test('동일 autheliaId로 재요청 시 새 사용자를 ��성하지 않고 기존 사용자를 반��한다 (edge case)', async ({
    request,
  }) => {
    // Global setup에서 미리 생성된 testuser 활용 (e2e-user-uid-001)
    // 첫 번째 요청
    const firstResponse = await request.get('/api/me', {
      ...withAuthHeader(
        TEST_USERS.user.autheliaId,
        TEST_USERS.user.username,
        TEST_USERS.user.email
      ),
    });

    expect(firstResponse.status()).toBe(200);
    const firstBody = await firstResponse.json();

    // 두 번째 요청 (동일 autheliaId)
    const secondResponse = await request.get('/api/me', {
      ...withAuthHeader(
        TEST_USERS.user.autheliaId,
        TEST_USERS.user.username,
        TEST_USERS.user.email
      ),
    });

    expect(secondResponse.status()).toBe(200);
    const secondBody = await secondResponse.json();

    // 동일한 사용자 ID가 반환되어야 함 (새 레코드 생성 없음)
    expect(secondBody.id).toBe(firstBody.id);
    expect(secondBody.autheliaId).toBe(TEST_USERS.user.autheliaId);
  });

  test('Remote-Email 변경 시 사용자 email 필드가 업데이트된다 (edge case)', async ({
    request,
  }) => {
    // Global setup에서 미리 생성된 admin 사용자 활용
    const updatedEmail = 'admin-updated@example.com';

    // 변경된 email 헤더로 요청
    const response = await request.get('/api/me', {
      headers: {
        'Remote-User': TEST_USERS.admin.autheliaId,
        'Remote-Email': updatedEmail,
        'Remote-Name': TEST_USERS.admin.displayName,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();
    // email이 헤더에 전달된 새 값으로 업데이트되어야 함
    expect(body.email).toBe(updatedEmail);

    // 원래 email로 복원 (다른 테스트에 영향 없도록)
    await request.get('/api/me', {
      headers: {
        'Remote-User': TEST_USERS.admin.autheliaId,
        'Remote-Email': TEST_USERS.admin.email,
        'Remote-Name': TEST_USERS.admin.displayName,
      },
    });
  });
});
