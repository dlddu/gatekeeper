/**
 * 설정 페이지 (app/settings/page.tsx) unit 테스트
 *
 * TDD Red Phase — 구현 전 테스트 작성.
 * 이 테스트는 구현 코드가 작성되기 전까지 실패 상태입니다.
 *
 * 검증 범위:
 * 1. 파일 존재 및 Next.js App Router 구조 준수
 * 2. 페이지 소스 코드 정적 분석으로 UI 요구사항 구조 검증
 *    - 'use client' 디렉티브
 *    - BottomNav import 및 JSX 렌더링
 *    - 페이지 제목 "설정"
 *    - 알림 토글 UI (toggle/checkbox, state 존재)
 *    - 5가지 상태: loading / disabled / enabled / denied / unsupported
 * 3. 인증 처리 (Forward Auth)
 *    - localStorage 기반 JWT 인증 로직 제거 (Traefik이 처리)
 *    - useEffect로 UI 초기화 로직 처리
 * 4. Push API 지원 여부 처리
 *    - serviceWorker 지원 확인
 *    - PushManager 지원 확인
 *    - Notification API 확인
 *    - Notification.requestPermission() 호출
 *    - pushManager.subscribe() 호출
 *    - POST /api/me/push/subscribe
 *    - pushManager.getSubscription() 호출
 *    - unsubscribe() 호출
 *    - DELETE /api/me/push/unsubscribe
 *    - denied 분기 처리
 *    - Forward Auth 기반 인증 (Authorization/Bearer 헤더 제거)
 * 5. VAPID 키 처리
 *    - applicationServerKey 전달
 *    - userVisibleOnly: true
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
// 섹션 2: UI 요구사항 — 소스 코드 정적 분석
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
    it("파일 상단에 'use client' 디렉티브가 포함되어야 한다", () => {
      // Assert — Client Component이므로 필수
      expect(source).toMatch(/['"]use client['"]/);
    });
  });

  // ----------------------------------------------------------------
  // 2-2. BottomNav 컴포넌트
  // ----------------------------------------------------------------
  describe('BottomNav 컴포넌트', () => {
    it('BottomNav를 import해야 한다', () => {
      // Assert — 기존 네비게이션 컴포넌트 재사용
      expect(source).toContain('BottomNav');
    });

    it('BottomNav를 JSX에서 렌더링해야 한다', () => {
      // Assert — <BottomNav 또는 <BottomNav/> 패턴
      expect(source).toMatch(/<BottomNav[\s/>]/);
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
      // Assert — h1~h6 태그 중 하나 이상 존재
      expect(source).toMatch(/<h[1-6][^>]*>/);
    });
  });

  // ----------------------------------------------------------------
  // 2-4. 알림 토글 UI
  // ----------------------------------------------------------------
  describe('알림 토글 UI', () => {
    it('토글 또는 체크박스 입력 요소가 존재해야 한다', () => {
      // Assert — <input type="checkbox"> 또는 toggle 관련 요소
      const hasCheckbox = source.includes('checkbox');
      const hasToggle = source.toLowerCase().includes('toggle');
      expect(hasCheckbox || hasToggle).toBe(true);
    });

    it('알림 관련 상태(state)가 존재해야 한다', () => {
      // Assert — useState로 알림 상태 관리
      const hasNotificationState = source.includes('notification') || source.includes('Notification');
      const hasPushState = source.includes('push') || source.includes('Push');
      const hasSubscribeState = source.includes('subscribe') || source.includes('Subscribe');
      expect(hasNotificationState || hasPushState || hasSubscribeState).toBe(true);
    });

    it('알림 설정 관련 텍스트가 포함되어야 한다', () => {
      // Assert — "알림" 텍스트 포함
      expect(source).toContain('알림');
    });
  });

  // ----------------------------------------------------------------
  // 2-5. 5가지 상태 처리: loading / disabled / enabled / denied / unsupported
  // ----------------------------------------------------------------
  describe('Push 알림 5가지 상태 처리', () => {
    it('loading 상태를 처리해야 한다', () => {
      // Assert
      const hasLoading = source.includes('loading') || source.includes('Loading');
      expect(hasLoading).toBe(true);
    });

    it('disabled 상태를 처리해야 한다', () => {
      // Assert — 비활성화 상태 분기 또는 disabled 속성
      expect(source).toContain('disabled');
    });

    it('enabled 상태를 처리해야 한다', () => {
      // Assert — 구독 활성화 상태
      const hasEnabled = source.includes('enabled') || source.includes('subscribed') || source.includes('Subscribed');
      expect(hasEnabled).toBe(true);
    });

    it('denied 상태를 처리해야 한다', () => {
      // Assert — 알림 권한 거부 상태 분기
      expect(source).toContain('denied');
    });

    it('unsupported 상태를 처리해야 한다', () => {
      // Assert — Push API 미지원 상태 분기
      const hasUnsupported = source.includes('unsupported') || source.includes('Unsupported');
      expect(hasUnsupported).toBe(true);
    });
  });
});

// ============================================================
// 섹션 3: 인증 처리
// ============================================================

describe('app/settings/page.tsx — 인증 처리 (Forward Auth)', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(PAGE_PATH, 'utf-8');
  });

  it('localStorage 기반 JWT 인증 로직이 제거되어야 한다 (Forward Auth 전환)', () => {
    // Forward Auth에서는 Traefik이 인증을 처리하므로 클라이언트 측 JWT 로직 불필요
    expect(source).not.toContain('localStorage');
    expect(source).not.toContain('/login');
  });

  it('useEffect로 UI 초기화 로직을 처리해야 한다', () => {
    // Assert — 마운트 시 Push 알림 상태 확인 등
    expect(source).toContain('useEffect');
  });
});

// ============================================================
// 섹션 4: Push API 지원 여부 처리
// ============================================================

describe('app/settings/page.tsx — Push API 지원 여부 처리', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(PAGE_PATH, 'utf-8');
  });

  // ----------------------------------------------------------------
  // 4-1. API 지원 여부 확인
  // ----------------------------------------------------------------
  describe('Push API 지원 여부 확인', () => {
    it('serviceWorker 지원 여부를 확인하는 로직이 포함되어야 한다', () => {
      // Assert — navigator.serviceWorker 존재 확인
      expect(source).toContain('serviceWorker');
    });

    it('PushManager 지원 여부를 확인하는 로직이 포함되어야 한다', () => {
      // Assert — PushManager 존재 확인
      expect(source).toContain('PushManager');
    });

    it('Notification API 지원 여부를 확인하는 로직이 포함되어야 한다', () => {
      // Assert — Notification 객체 존재 확인
      expect(source).toContain('Notification');
    });
  });

  // ----------------------------------------------------------------
  // 4-2. 토글 ON: 구독 흐름
  // ----------------------------------------------------------------
  describe('토글 ON — 구독 흐름', () => {
    it('Notification.requestPermission()을 호출하는 로직이 포함되어야 한다', () => {
      // Assert — 알림 권한 요청
      expect(source).toContain('requestPermission');
    });

    it('pushManager.subscribe()를 호출하는 로직이 포함되어야 한다', () => {
      // Assert — Push 구독 등록
      expect(source).toContain('subscribe');
    });

    it('POST /api/me/push/subscribe를 호출하는 로직이 포함되어야 한다', () => {
      // Assert — 서버에 구독 정보 전송
      expect(source).toContain('/api/me/push/subscribe');
      const hasPost = source.includes("method: 'POST'") || source.includes('method: "POST"');
      expect(hasPost).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 4-3. 토글 OFF: 구독 해제 흐름
  // ----------------------------------------------------------------
  describe('토글 OFF — 구독 해제 흐름', () => {
    it('pushManager.getSubscription()을 호출하는 로직이 포함되어야 한다', () => {
      // Assert — 현재 구독 정보 조회
      expect(source).toContain('getSubscription');
    });

    it('unsubscribe()를 호출하는 로직이 포함되어야 한다', () => {
      // Assert — Push 구독 해제
      expect(source).toContain('unsubscribe');
    });

    it('DELETE /api/me/push/unsubscribe를 호출하는 로직이 포함되어야 한다', () => {
      // Assert — 서버에서 구독 정보 삭제
      expect(source).toContain('/api/me/push/unsubscribe');
      const hasDelete = source.includes("method: 'DELETE'") || source.includes('method: "DELETE"');
      expect(hasDelete).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 4-4. denied 분기 처리
  // ----------------------------------------------------------------
  describe('denied 권한 거부 처리', () => {
    it('권한이 denied인 경우 분기 처리가 존재해야 한다', () => {
      // Assert — 'denied' 문자열로 권한 상태 비교
      expect(source).toContain('denied');
    });
  });

  // ----------------------------------------------------------------
  // 4-5. JWT Bearer 토큰 Authorization 헤더
  // ----------------------------------------------------------------
  describe('Forward Auth 기반 인증 (JWT Bearer 제거)', () => {
    it('Authorization/Bearer 헤더 전송 로직이 제거되어야 한다', () => {
      // Forward Auth에서는 Traefik이 인증 헤더를 추가하므로 클라이언트에서 불필요
      expect(source).not.toContain('Authorization');
      expect(source).not.toContain('Bearer');
    });
  });
});

// ============================================================
// 섹션 5: VAPID 키 처리
// ============================================================

describe('app/settings/page.tsx — VAPID 키 처리', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(PAGE_PATH, 'utf-8');
  });

  it('applicationServerKey를 subscribe() 호출 시 전달해야 한다', () => {
    // Assert — VAPID Public Key를 applicationServerKey로 전달
    expect(source).toContain('applicationServerKey');
  });

  it('userVisibleOnly: true를 subscribe() 옵션에 포함해야 한다', () => {
    // Assert — Web Push 표준 요구사항
    expect(source).toContain('userVisibleOnly');
  });

  it('NEXT_PUBLIC_VAPID_PUBLIC_KEY 환경변수를 참조해야 한다', () => {
    // Assert — 환경변수에서 VAPID 공개 키를 읽어야 함
    expect(source).toContain('NEXT_PUBLIC_VAPID_PUBLIC_KEY');
  });
});
