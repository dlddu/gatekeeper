/**
 * 설정 페이지 (app/settings/page.tsx) unit 테스트
 *
 * TDD Red Phase — 구현 전 테스트 작성.
 * 이 테스트는 구현 코드가 작성되기 전까지 실패 상태입니다.
 *
 * 검증 범위:
 * 1. 파일 존재 및 Next.js App Router 구조 준수
 * 2. 페이지 소스 코드 정적 분석으로 UI 요구사항 구조 검증
 *    - 'use client' 디렉티브 (브라우저 API 사용 필수)
 *    - BottomNav 컴포넌트 import 및 사용
 *    - 페이지 제목 "설정"
 *    - 알림 토글 UI 존재
 *    - loading / disabled / enabled / denied / unsupported 상태 처리
 * 3. 인증 체크 패턴 (localStorage token 확인 → /login 리다이렉트)
 * 4. Push API 지원 여부에 따른 상태 처리
 * 5. Push 구독/해제 API 호출 패턴
 *
 * 테스트 환경: node (Jest 기본 환경, ts-jest)
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PAGE_PATH = path.join(ROOT, 'app', 'settings', 'page.tsx');

// ============================================================
// 섹션 1: 파일 존재 및 App Router 구조 검증
// ============================================================

describe('app/settings/page.tsx — 파일 존재 및 구조', () => {
  it('app/settings/ 디렉토리가 존재해야 한다', () => {
    // Arrange
    const dirPath = path.join(ROOT, 'app', 'settings');

    // Assert
    expect(fs.existsSync(dirPath)).toBe(true);
    expect(fs.statSync(dirPath).isDirectory()).toBe(true);
  });

  it('app/settings/page.tsx 파일이 존재해야 한다', () => {
    // Assert
    expect(fs.existsSync(PAGE_PATH)).toBe(true);
  });

  it('page.tsx가 default export를 포함해야 한다', () => {
    // Arrange
    const source = fs.readFileSync(PAGE_PATH, 'utf-8');

    // Assert — Next.js App Router는 default export 컴포넌트 필수
    expect(source).toMatch(/export\s+default\s+(function|const|async\s+function)/);
  });

  it('page.tsx가 TypeScript로 작성되어야 한다 (.tsx 확장자)', () => {
    // Assert
    expect(PAGE_PATH.endsWith('.tsx')).toBe(true);
  });
});

// ============================================================
// 섹션 2: 페이지 UI 요구사항 — 소스 코드 정적 분석
// ============================================================

describe('app/settings/page.tsx — UI 요구사항 정적 분석', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(PAGE_PATH, 'utf-8');
  });

  // ----------------------------------------------------------------
  // 2-1. 'use client' 디렉티브
  // ----------------------------------------------------------------
  describe("'use client' 디렉티브", () => {
    it("파일 상단에 'use client' 디렉티브가 있어야 한다", () => {
      // Assert — 브라우저 API(Notification, PushManager, localStorage) 사용을 위해 필수
      expect(source).toMatch(/^['"]use client['"]/);
    });
  });

  // ----------------------------------------------------------------
  // 2-2. BottomNav 컴포넌트 재사용
  // ----------------------------------------------------------------
  describe('BottomNav 컴포넌트', () => {
    it('BottomNav를 @/components/BottomNav에서 import해야 한다', () => {
      // Assert
      expect(source).toContain('BottomNav');
      expect(source).toContain('@/components/BottomNav');
    });

    it('JSX에서 <BottomNav /> 컴포넌트를 렌더링해야 한다', () => {
      // Assert — 실제로 렌더링되어야 함
      expect(source).toMatch(/<BottomNav\s*\/?>/);
    });
  });

  // ----------------------------------------------------------------
  // 2-3. 페이지 제목 "설정"
  // ----------------------------------------------------------------
  describe('페이지 제목 "설정"', () => {
    it('페이지에 "설정" 텍스트가 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('설정');
    });

    it('heading 역할을 가진 요소(h1~h6)가 존재해야 한다', () => {
      // Assert — 페이지 제목 heading 태그
      expect(source).toMatch(/<h[1-6][^>]*>/);
    });
  });

  // ----------------------------------------------------------------
  // 2-4. 알림 토글 UI
  // ----------------------------------------------------------------
  describe('알림 토글 UI', () => {
    it('"알림" 또는 "Push" 관련 텍스트가 포함되어야 한다', () => {
      // Assert — 알림 설정 레이블
      const hasNotificationLabel =
        source.includes('알림') ||
        source.includes('Push') ||
        source.includes('push') ||
        source.includes('푸시');
      expect(hasNotificationLabel).toBe(true);
    });

    it('토글 또는 체크박스 입력 요소가 존재해야 한다', () => {
      // Assert — 구독 ON/OFF를 제어하는 입력 요소
      const hasToggle =
        source.includes('checkbox') ||
        source.includes('toggle') ||
        source.includes('Toggle') ||
        source.match(/type=['"]checkbox['"]/);
      expect(hasToggle).toBeTruthy();
    });

    it('토글 상태를 관리하는 state가 존재해야 한다', () => {
      // Assert — 구독 여부를 추적하는 상태
      const hasSubscribedState =
        source.includes('subscribed') ||
        source.includes('isSubscribed') ||
        source.includes('enabled') ||
        source.includes('isEnabled');
      expect(hasSubscribedState).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 2-5. 5가지 상태 처리: loading / disabled / enabled / denied / unsupported
  // ----------------------------------------------------------------
  describe('Push 알림 상태 처리', () => {
    it('loading 상태를 처리해야 한다', () => {
      // Assert — 초기화 또는 API 호출 중 로딩 상태
      const hasLoadingState =
        source.includes('loading') ||
        source.includes('Loading') ||
        source.includes('isLoading');
      expect(hasLoadingState).toBe(true);
    });

    it('disabled 상태를 처리해야 한다', () => {
      // Assert — 토글 비활성화 상태 (예: 처리 중)
      expect(source).toContain('disabled');
    });

    it('denied 상태(알림 권한 거부)를 처리해야 한다', () => {
      // Assert — Notification.permission === 'denied' 또는 'denied' 리터럴
      expect(source).toContain('denied');
    });

    it('unsupported 상태(브라우저 미지원)를 처리해야 한다', () => {
      // Assert — Push API 미지원 브라우저 처리
      const hasUnsupported =
        source.includes('unsupported') ||
        source.includes('Unsupported') ||
        source.includes('지원하지 않') ||
        source.includes('지원되지 않');
      expect(hasUnsupported).toBe(true);
    });

    it('enabled/구독 활성화 상태를 처리해야 한다', () => {
      // Assert — 구독이 활성화된 상태 표현
      const hasEnabledState =
        source.includes('enabled') ||
        source.includes('subscribed') ||
        source.includes('구독 중') ||
        source.includes('활성');
      expect(hasEnabledState).toBe(true);
    });
  });
});

// ============================================================
// 섹션 3: 인증 처리 패턴 검증
// ============================================================

describe('app/settings/page.tsx — 인증 처리', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(PAGE_PATH, 'utf-8');
  });

  it('localStorage에서 JWT 토큰을 읽는 로직이 포함되어야 한다', () => {
    // Assert — 기존 requests/page.tsx, history/page.tsx와 동일한 패턴
    expect(source).toContain('localStorage');
    expect(source).toContain('token');
  });

  it('토큰이 없는 경우 /login으로 리다이렉트하는 로직이 포함되어야 한다', () => {
    // Assert
    expect(source).toContain('/login');
  });

  it('useRouter를 import하고 사용해야 한다', () => {
    // Assert — Next.js App Router 리다이렉트 패턴
    expect(source).toContain('useRouter');
    expect(source).toContain('next/navigation');
  });

  it('useEffect 안에서 인증 체크를 수행해야 한다', () => {
    // Assert — 클라이언트 사이드 인증 체크
    expect(source).toContain('useEffect');
  });

  it('401 응답 시 token을 제거하고 /login으로 리다이렉트해야 한다', () => {
    // Assert — API 응답 401 처리 (기존 페이지들과 동일한 패턴)
    const hasTokenRemoval =
      source.includes('removeItem') ||
      source.includes('localStorage.removeItem');
    expect(hasTokenRemoval).toBe(true);
  });
});

// ============================================================
// 섹션 4: Push API 지원 여부 및 권한 상태 처리
// ============================================================

describe('app/settings/page.tsx — Push API 지원 여부 처리', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(PAGE_PATH, 'utf-8');
  });

  // ----------------------------------------------------------------
  // 4-1. Push 지원 여부 체크
  // ----------------------------------------------------------------
  describe('Push API 브라우저 지원 여부 확인', () => {
    it('serviceWorker 지원 여부를 확인하는 로직이 포함되어야 한다', () => {
      // Assert — navigator.serviceWorker 존재 여부 체크
      const hasServiceWorkerCheck =
        source.includes('serviceWorker') ||
        source.includes('ServiceWorker');
      expect(hasServiceWorkerCheck).toBe(true);
    });

    it('PushManager 지원 여부를 확인하는 로직이 포함되어야 한다', () => {
      // Assert — PushManager 또는 pushManager 참조
      const hasPushManagerCheck =
        source.includes('PushManager') ||
        source.includes('pushManager');
      expect(hasPushManagerCheck).toBe(true);
    });

    it('Notification API 지원 여부를 확인하는 로직이 포함되어야 한다', () => {
      // Assert — Notification 객체 참조
      expect(source).toContain('Notification');
    });
  });

  // ----------------------------------------------------------------
  // 4-2. 알림 권한 요청 (토글 ON)
  // ----------------------------------------------------------------
  describe('알림 권한 요청 및 구독 (토글 ON)', () => {
    it('Notification.requestPermission()을 호출하는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('requestPermission');
    });

    it('pushManager.subscribe()를 호출하는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('subscribe');
    });

    it('POST /api/me/push/subscribe 엔드포인트를 호출하는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('/api/me/push/subscribe');
    });

    it('구독 시 POST 메서드를 사용해야 한다', () => {
      // Assert — fetch 호출에서 POST 메서드 사용
      expect(source).toContain('POST');
    });
  });

  // ----------------------------------------------------------------
  // 4-3. 구독 해제 (토글 OFF)
  // ----------------------------------------------------------------
  describe('구독 해제 (토글 OFF)', () => {
    it('pushManager.getSubscription()을 호출하는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('getSubscription');
    });

    it('unsubscribe()를 호출하는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('unsubscribe');
    });

    it('DELETE /api/me/push/unsubscribe 엔드포인트를 호출하는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('/api/me/push/unsubscribe');
    });

    it('구독 해제 시 DELETE 메서드를 사용해야 한다', () => {
      // Assert
      expect(source).toContain('DELETE');
    });
  });

  // ----------------------------------------------------------------
  // 4-4. 권한 거부(denied) 처리
  // ----------------------------------------------------------------
  describe('알림 권한 거부(denied) 처리', () => {
    it('권한이 denied인 경우를 분기 처리해야 한다', () => {
      // Assert — Notification.permission === 'denied' 또는 조건 분기
      expect(source).toContain('denied');
    });

    it('권한 거부 시 토글이 비활성화되거나 안내 메시지가 표시되어야 한다', () => {
      // Assert — disabled 속성 또는 안내 텍스트
      const hasDeniedFeedback =
        source.includes('disabled') ||
        source.includes('권한') ||
        source.includes('거부') ||
        source.includes('차단');
      expect(hasDeniedFeedback).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 4-5. JWT Bearer 토큰 전송
  // ----------------------------------------------------------------
  describe('API 호출 시 JWT 인증', () => {
    it('JWT Bearer 토큰을 Authorization 헤더로 전송해야 한다', () => {
      // Assert — 기존 페이지들과 동일한 인증 패턴
      const hasAuthorization = source.includes('Authorization');
      const hasBearer = source.includes('Bearer');
      expect(hasAuthorization && hasBearer).toBe(true);
    });
  });
});

// ============================================================
// 섹션 5: VAPID applicationServerKey 처리
// ============================================================

describe('app/settings/page.tsx — VAPID 키 처리', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(PAGE_PATH, 'utf-8');
  });

  it('pushManager.subscribe() 호출 시 applicationServerKey를 전달해야 한다', () => {
    // Assert — VAPID 공개키를 subscribe 옵션으로 전달
    expect(source).toContain('applicationServerKey');
  });

  it('userVisibleOnly: true 옵션을 사용해야 한다', () => {
    // Assert — Push 구독 시 userVisibleOnly 필수
    expect(source).toContain('userVisibleOnly');
  });
});
