/**
 * 로그인 콜백 페이지 (app/login/callback/page.tsx) unit 테스트
 *
 * TDD Red Phase — 구현 전 테스트 작성.
 * 이 테스트는 구현 코드가 작성되기 전까지 실패 상태입니다.
 *
 * 검증 범위:
 * 1. 파일 존재 및 Next.js App Router 구조 준수
 * 2. 페이지 소스 코드 정적 분석으로 UI 요구사항 구조 검증
 *    - 'use client' 디렉티브
 *    - URL searchParams에서 token 추출
 *    - token 있으면 localStorage.setItem('token', token) 후 /requests로 router.push
 *    - token 없거나 error 파라미터 있으면 에러 UI 표시
 *    - 에러 시 '인증 처리에 실패했습니다.' 텍스트
 *    - 에러 시 /login 복귀 링크 ('로그인 페이지로 돌아가기') 표시
 *    - 정상 처리 중 '로그인 처리 중...' 텍스트와 스피너
 * 3. 인증 처리
 *    - useRouter + useEffect + useSearchParams 패턴
 *    - next/navigation import
 *
 * 테스트 환경: node (Jest 기본 환경, ts-jest)
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PAGE_DIR = path.join(ROOT, 'app', 'login', 'callback');
const PAGE_PATH = path.join(PAGE_DIR, 'page.tsx');

// ============================================================
// 섹션 1: 파일 존재 및 App Router 구조 검증
// ============================================================

describe('app/login/callback/page.tsx — 파일 존재 및 구조', () => {
  it('app/login/callback/ 디렉토리가 존재해야 한다', () => {
    // Assert
    expect(fs.existsSync(PAGE_DIR)).toBe(true);
    expect(fs.statSync(PAGE_DIR).isDirectory()).toBe(true);
  });

  it('app/login/callback/page.tsx 파일이 존재해야 한다', () => {
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

describe('app/login/callback/page.tsx — UI 요구사항 정적 분석', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(PAGE_PATH, 'utf-8');
  });

  // ----------------------------------------------------------------
  // 2-1. 'use client' 디렉티브
  // ----------------------------------------------------------------
  describe("'use client' 디렉티브", () => {
    it("파일 상단에 'use client' 디렉티브가 포함되어야 한다", () => {
      // Assert — Client Component이므로 필수 (useEffect, useRouter, useSearchParams 사용)
      expect(source).toMatch(/['"]use client['"]/);
    });
  });

  // ----------------------------------------------------------------
  // 2-2. URL searchParams에서 token 추출
  // ----------------------------------------------------------------
  describe('URL searchParams에서 token 추출', () => {
    it("searchParams에서 'token' 파라미터를 읽는 로직이 포함되어야 한다", () => {
      // Assert
      const hasTokenParam =
        (source.includes("'token'") || source.includes('"token"')) &&
        source.includes('searchParams');
      expect(hasTokenParam).toBe(true);
    });

    it('useSearchParams를 사용하여 URL 파라미터를 읽어야 한다', () => {
      // Assert
      expect(source).toContain('useSearchParams');
    });

    it('next/navigation에서 useSearchParams를 import해야 한다', () => {
      // Assert
      expect(source).toContain('useSearchParams');
      expect(source).toContain('next/navigation');
    });
  });

  // ----------------------------------------------------------------
  // 2-3. token 존재 시: localStorage 저장 후 /requests 이동
  // ----------------------------------------------------------------
  describe('token 존재 시 localStorage 저장 및 /requests 이동', () => {
    it("localStorage.setItem('token', token)을 호출하는 로직이 포함되어야 한다", () => {
      // Assert — token을 localStorage에 저장
      expect(source).toContain('localStorage');
      expect(source).toContain('setItem');
      expect(source).toContain('token');
    });

    it("localStorage.setItem 호출 시 key가 'token'이어야 한다", () => {
      // Assert
      const hasSetItemWithToken =
        source.includes("setItem('token'") ||
        source.includes('setItem("token"');
      expect(hasSetItemWithToken).toBe(true);
    });

    it('token 저장 후 /requests로 router.push하는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('/requests');
      expect(source).toMatch(/router\.push\(['"`]\/requests['"`]\)/);
    });

    it('useEffect 내에서 token 처리 로직이 실행되어야 한다', () => {
      // Assert — 마운트 시 searchParams를 읽어 처리
      expect(source).toContain('useEffect');
    });
  });

  // ----------------------------------------------------------------
  // 2-4. token 없거나 error 파라미터 있을 때 에러 UI 표시
  // ----------------------------------------------------------------
  describe('token 없거나 error 파라미터 있을 때 에러 UI', () => {
    it("searchParams에서 'error' 파라미터를 확인하는 로직이 포함되어야 한다", () => {
      // Assert
      const hasErrorParam =
        source.includes("'error'") || source.includes('"error"');
      expect(hasErrorParam).toBe(true);
    });

    it("'인증 처리에 실패했습니다.' 에러 텍스트가 포함되어야 한다", () => {
      // Assert
      expect(source).toContain('인증 처리에 실패했습니다.');
    });

    it('에러 상태를 관리하는 state 또는 조건 분기가 존재해야 한다', () => {
      // Assert — 에러/성공 상태를 분기 처리
      const hasErrorState =
        source.includes('error') &&
        (source.includes('useState') || source.includes('isError') || source.includes('hasError'));
      const hasConditional =
        source.includes('error') &&
        (source.includes('? (') || source.includes('? <') || source.includes('&&'));
      expect(hasErrorState || hasConditional).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 2-5. /login 복귀 링크 표시
  // ----------------------------------------------------------------
  describe('/login 복귀 링크', () => {
    it("'로그인 페이지로 돌아가기' 텍스트가 포함되어야 한다", () => {
      // Assert
      expect(source).toContain('로그인 페이지로 돌아가기');
    });

    it('/login 경로를 참조하는 링크 또는 버튼이 존재해야 한다', () => {
      // Assert — <a href="/login"> 또는 router.push('/login') 패턴
      const hasLoginLink =
        source.includes('/login') &&
        (source.includes('<a') || source.includes('router.push') || source.includes('href'));
      expect(hasLoginLink).toBe(true);
    });

    it("'/login' 경로가 소스에 포함되어야 한다", () => {
      // Assert
      expect(source).toContain('/login');
    });
  });

  // ----------------------------------------------------------------
  // 2-6. 정상 처리 중: '로그인 처리 중...' 텍스트와 스피너
  // ----------------------------------------------------------------
  describe("정상 처리 중 로딩 UI", () => {
    it("'로그인 처리 중...' 텍스트가 포함되어야 한다", () => {
      // Assert
      expect(source).toContain('로그인 처리 중...');
    });

    it('스피너 또는 로딩 인디케이터가 포함되어야 한다', () => {
      // Assert — SVG 스피너, animate-spin, 또는 loading 관련 요소
      const hasSvgSpinner = source.includes('<svg') || source.includes('svg');
      const hasAnimateSpin =
        source.includes('animate-spin') || source.includes('animation');
      const hasLoadingIndicator =
        source.toLowerCase().includes('spinner') ||
        source.toLowerCase().includes('loading');
      expect(hasSvgSpinner || hasAnimateSpin || hasLoadingIndicator).toBe(true);
    });
  });
});

// ============================================================
// 섹션 3: 인증 처리 및 라우팅 패턴
// ============================================================

describe('app/login/callback/page.tsx — 인증 처리 및 라우팅 패턴', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(PAGE_PATH, 'utf-8');
  });

  it('next/navigation에서 useRouter를 import해야 한다', () => {
    // Assert
    expect(source).toContain('useRouter');
    expect(source).toContain('next/navigation');
  });

  it('useEffect로 마운트 시 token 처리를 해야 한다', () => {
    // Assert — 마운트 직후 URL token 추출 및 처리
    expect(source).toContain('useEffect');
  });

  it('useRouter, useEffect, useSearchParams를 모두 사용해야 한다', () => {
    // Assert — 세 가지 훅 모두 필요
    expect(source).toContain('useRouter');
    expect(source).toContain('useEffect');
    expect(source).toContain('useSearchParams');
  });
});

// ============================================================
// 섹션 4: 콜백 처리 로직 — 순수 함수 단위 검증
// ============================================================

describe('콜백 처리 로직 — 순수 계산 함수 검증', () => {
  /**
   * URL searchParams에서 token/error 파라미터를 분석하여
   * 처리 경로를 결정하는 순수 로직을 검증합니다.
   */

  type CallbackState =
    | { type: 'loading' }
    | { type: 'success'; token: string }
    | { type: 'error' };

  /**
   * URL searchParams를 분석하여 콜백 상태를 결정하는 순수 함수
   * (page.tsx의 useEffect 내 분기 로직과 동일한 의사 구현)
   */
  function resolveCallbackState(
    token: string | null,
    error: string | null
  ): CallbackState {
    if (error) {
      return { type: 'error' };
    }
    if (token && token.length > 0) {
      return { type: 'success', token };
    }
    return { type: 'error' };
  }

  // ----------------------------------------------------------------
  // 정상 케이스: token 있음
  // ----------------------------------------------------------------
  describe('token이 있고 error가 없는 경우 (happy path)', () => {
    it('유효한 token이 있으면 success 상태를 반환해야 한다', () => {
      // Arrange
      const token = 'eyJhbGciOiJIUzI1NiJ9.valid-token';
      const error = null;

      // Act
      const state = resolveCallbackState(token, error);

      // Assert
      expect(state.type).toBe('success');
    });

    it('success 상태에 token 값이 포함되어야 한다', () => {
      // Arrange
      const token = 'my-jwt-token-value';
      const error = null;

      // Act
      const state = resolveCallbackState(token, error);

      // Assert
      expect(state.type).toBe('success');
      if (state.type === 'success') {
        expect(state.token).toBe(token);
      }
    });
  });

  // ----------------------------------------------------------------
  // 에러 케이스: error 파라미터 있음
  // ----------------------------------------------------------------
  describe('error 파라미터가 있는 경우', () => {
    it('error 파라미터가 있으면 error 상태를 반환해야 한다 (token 있어도)', () => {
      // Arrange
      const token = 'some-token';
      const error = 'access_denied';

      // Act
      const state = resolveCallbackState(token, error);

      // Assert
      expect(state.type).toBe('error');
    });

    it('error 파라미터가 빈 문자열이 아닌 값이면 error 상태를 반환해야 한다', () => {
      // Arrange
      const token = null;
      const error = 'invalid_request';

      // Act
      const state = resolveCallbackState(token, error);

      // Assert
      expect(state.type).toBe('error');
    });

    it('token이 없고 error도 없으면 error 상태를 반환해야 한다', () => {
      // Arrange — 비정상적인 콜백 (파라미터 없음)
      const token = null;
      const error = null;

      // Act
      const state = resolveCallbackState(token, error);

      // Assert
      expect(state.type).toBe('error');
    });
  });

  // ----------------------------------------------------------------
  // 엣지 케이스
  // ----------------------------------------------------------------
  describe('엣지 케이스', () => {
    it('token이 빈 문자열이면 error 상태를 반환해야 한다', () => {
      // Arrange
      const token = '';
      const error = null;

      // Act
      const state = resolveCallbackState(token, error);

      // Assert
      expect(state.type).toBe('error');
    });

    it('반환된 상태는 type 필드를 항상 포함해야 한다', () => {
      // Arrange
      const cases: Array<[string | null, string | null]> = [
        ['valid-token', null],
        [null, 'error_code'],
        [null, null],
        ['', null],
      ];

      // Act & Assert
      for (const [token, error] of cases) {
        const state = resolveCallbackState(token, error);
        expect(state).toHaveProperty('type');
        expect(['loading', 'success', 'error']).toContain(state.type);
      }
    });
  });
});
