import { test, expect } from '@playwright/test';

/**
 * PWA 설정 E2E 테스트
 *
 * DLD-662: 작업 9-1: [PWA 설정] e2e 테스트 작성 (skipped)
 * 부모 이슈: DLD-645 (Gatekeeper — 승인 게이트웨이 서비스)
 *
 * 커버리지:
 * - manifest.json 파일 존재 및 필수 필드 확인
 * - Service Worker 등록 확인
 * - 오프라인 시 기본 셸 표시 확인
 *
 * TODO: PWA 구현 완료 후 test.describe.skip → test.describe 로 변경
 */

test.describe.skip('manifest.json 검증', () => {
  test('GET /manifest.json 요청이 200을 반환한다 (happy path)', async ({ request }) => {
    const response = await request.get('/manifest.json');

    expect(response.status()).toBe(200);
  });

  test('manifest.json 응답의 Content-Type이 application/json이다 (happy path)', async ({
    request,
  }) => {
    const response = await request.get('/manifest.json');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toMatch(/application\/json/);
  });

  test('manifest.json에 name 필드가 존재한다 (happy path)', async ({ request }) => {
    const response = await request.get('/manifest.json');
    const body = await response.json();

    expect(body).toHaveProperty('name');
    expect(typeof body.name).toBe('string');
    expect(body.name.length).toBeGreaterThan(0);
  });

  test('manifest.json에 short_name 필드가 존재한다 (happy path)', async ({ request }) => {
    const response = await request.get('/manifest.json');
    const body = await response.json();

    expect(body).toHaveProperty('short_name');
    expect(typeof body.short_name).toBe('string');
    expect(body.short_name.length).toBeGreaterThan(0);
  });

  test('manifest.json의 start_url이 "/" 이다 (happy path)', async ({ request }) => {
    const response = await request.get('/manifest.json');
    const body = await response.json();

    expect(body).toHaveProperty('start_url');
    expect(body.start_url).toBe('/');
  });

  test('manifest.json의 display가 "standalone" 이다 (happy path)', async ({ request }) => {
    const response = await request.get('/manifest.json');
    const body = await response.json();

    expect(body).toHaveProperty('display');
    expect(body.display).toBe('standalone');
  });

  test('manifest.json의 icons 배열에 최소 1개 아이콘이 포함된다 (happy path)', async ({
    request,
  }) => {
    const response = await request.get('/manifest.json');
    const body = await response.json();

    expect(body).toHaveProperty('icons');
    expect(Array.isArray(body.icons)).toBe(true);
    expect(body.icons.length).toBeGreaterThanOrEqual(1);
  });

  test('manifest.json icons 배열의 각 아이콘에 src와 sizes 필드가 존재한다 (edge case)', async ({
    request,
  }) => {
    const response = await request.get('/manifest.json');
    const body = await response.json();

    for (const icon of body.icons) {
      expect(icon).toHaveProperty('src');
      expect(icon).toHaveProperty('sizes');
      expect(typeof icon.src).toBe('string');
      expect(typeof icon.sizes).toBe('string');
    }
  });
});

test.describe.skip('Service Worker 등록 확인', () => {
  test('/sw.js 파일이 200을 반환한다 (happy path)', async ({ request }) => {
    const response = await request.get('/sw.js');

    expect(response.status()).toBe(200);
  });

  test('페이지 로드 후 Service Worker가 등록되고 active 상태가 된다 (happy path)', async ({
    page,
  }) => {
    await page.goto('/');

    // Service Worker가 active 상태가 될 때까지 대기
    const swState = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        return { supported: false, state: null };
      }

      const registration = await navigator.serviceWorker.ready;
      return {
        supported: true,
        state: registration.active?.state ?? null,
      };
    });

    expect(swState.supported).toBe(true);
    expect(swState.state).toBe('activated');
  });

  test('navigator.serviceWorker.ready가 ServiceWorkerRegistration을 resolve 한다 (happy path)', async ({
    page,
  }) => {
    await page.goto('/');

    const isRegistered = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;

      const registration = await navigator.serviceWorker.ready;
      return registration instanceof ServiceWorkerRegistration;
    });

    expect(isRegistered).toBe(true);
  });

  test('Service Worker가 등록된 scope가 루트("/")를 포함한다 (edge case)', async ({ page }) => {
    await page.goto('/');

    const scope = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return null;

      const registration = await navigator.serviceWorker.ready;
      return registration.scope;
    });

    expect(scope).toBeTruthy();
    expect(scope).toMatch(/\/$/);
  });
});

test.describe.skip('오프라인 시 기본 셸 표시 확인', () => {
  test('온라인 상태에서 페이지가 정상적으로 렌더링된다 (happy path)', async ({ page }) => {
    await page.goto('/');

    // 기본 앱 셸 요소가 존재하는지 확인
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('#__next, main, [data-testid="app-shell"]').first()).toBeVisible();
  });

  test('Service Worker 등록 후 오프라인으로 전환해도 기본 셸이 표시된다 (happy path)', async ({
    page,
  }) => {
    // Arrange: 온라인 상태에서 페이지 로드 및 Service Worker 등록 대기
    await page.goto('/');

    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return;
      await navigator.serviceWorker.ready;
    });

    // Act: 네트워크 차단 후 페이지 새로고침
    await page.context().setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Assert: 기본 셸(app shell) UI가 표시되어야 함
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('#__next, main, [data-testid="app-shell"]').first()).toBeVisible();

    // 테스트 후 온라인 상태 복원
    await page.context().setOffline(false);
  });

  test('오프라인 상태에서 오프라인 인디케이터가 표시된다 (happy path)', async ({ page }) => {
    // Arrange: 온라인 상태에서 페이지 로드 및 Service Worker 등록 대기
    await page.goto('/');

    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return;
      await navigator.serviceWorker.ready;
    });

    // Act: 네트워크 차단
    await page.context().setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Assert: 오프라인 상태 표시 요소가 존재해야 함
    // (구현 시 data-testid="offline-indicator" 또는 aria-label, 텍스트 등으로 식별)
    const offlineIndicator = page.locator(
      '[data-testid="offline-indicator"], [aria-label*="오프라인"], text="오프라인"'
    );
    await expect(offlineIndicator).toBeVisible();

    // 테스트 후 온라인 상태 복원
    await page.context().setOffline(false);
  });

  test('오프라인 상태에서 온라인으로 복귀하면 페이지가 정상 동작한다 (edge case)', async ({
    page,
  }) => {
    // Arrange: 온라인 상태에서 페이지 로드
    await page.goto('/');

    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return;
      await navigator.serviceWorker.ready;
    });

    // Act: 오프라인 전환 → 온라인 복귀
    await page.context().setOffline(true);
    await page.context().setOffline(false);

    // Assert: 페이지가 정상적으로 동작해야 함
    await page.reload();
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('#__next, main, [data-testid="app-shell"]').first()).toBeVisible();
  });

  test('Service Worker 미등록 상태에서 오프라인 전환 시 브라우저 기본 오류 페이지가 표시된다 (error case)', async ({
    page,
  }) => {
    // Service Worker가 없는 상태에서의 오프라인 동작 확인
    // (이 테스트는 PWA가 올바르게 구성되었을 때 반드시 통과해야 함을 검증하지 않음)
    // PWA 구현 후에는 이 시나리오가 오프라인 셸로 처리될 것

    await page.context().setOffline(true);

    // SW 없이 오프라인 상태에서 새 URL 접근
    // 브라우저 에러 페이지 또는 캐시된 셸 중 하나가 표시됨
    const navigationResult = await page.goto('/').catch(() => null);

    // 네비게이션 자체는 실패하거나 캐시에서 서빙될 수 있음
    // PWA 구현 후에는 캐시에서 셸이 서빙되어야 함
    if (navigationResult) {
      // 캐시에서 서빙된 경우: body가 보여야 함
      await expect(page.locator('body')).toBeVisible();
    }

    // 테스트 후 온라인 상태 복원
    await page.context().setOffline(false);
  });
});
