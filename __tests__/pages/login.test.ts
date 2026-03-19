/**
 * 로그인 페이지 (app/login/page.tsx) unit 테스트
 *
 * TDD Red Phase — 구현 전 테스트 작성.
 * 이 테스트는 구현 코드가 작성되기 전까지 실패 상태입니다.
 *
 * 검증 범위:
 * 1. 파일 존재 및 Next.js App Router 구조 준수
 * 2. 페이지 소스 코드 정적 분석으로 UI 요구사항 구조 검증
 *    - 'use client' 디렉티브
 *    - username/password 폼 제거 확인
 *    - "로그인" 버튼: window.location.href = '/api/auth/oidc/authorize'로 이동
 *    - ?error 파라미터 감지 및 에러 메시지 표시
 *    - localStorage에 유효한 token이 있으면 /requests로 자동 리다이렉트
 *
 * 테스트 환경: node (Jest 기본 환경, ts-jest)
 * 테스트 방식: 소스 코드 정적 분석 (기존 pages 테스트 패턴 준수)
 *   - app/login/page.tsx는 'use client' 컴포넌트로 localStorage, window.location,
 *     useSearchParams 등 브라우저 API에 의존합니다.
 *   - Jest testEnvironment가 'node'이고 @testing-library/react가 설치되어 있지 않아
 *     컴포넌트를 직접 렌더링할 수 없습니다.
 *   - 기존 request-detail.test.ts, settings.test.ts와 동일한 정적 분석 패턴을 사용합니다.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PAGE_PATH = path.join(ROOT, 'app', 'login', 'page.tsx');

// ============================================================
// 섹션 1: 파일 존재 및 App Router 구조 검증
// ============================================================

describe('app/login/page.tsx — 파일 존재 및 구조', () => {
  it('app/login/ 디렉토리가 존재해야 한다', () => {
    // Arrange
    const dirPath = path.join(ROOT, 'app', 'login');

    // Assert
    expect(fs.existsSync(dirPath)).toBe(true);
    expect(fs.statSync(dirPath).isDirectory()).toBe(true);
  });

  it('app/login/page.tsx 파일이 존재해야 한다', () => {
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

describe('app/login/page.tsx — UI 요구사항 정적 분석', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(PAGE_PATH, 'utf-8');
  });

  // ----------------------------------------------------------------
  // 2-1. 'use client' 디렉티브
  // ----------------------------------------------------------------
  describe("'use client' 디렉티브", () => {
    it("파일 상단에 'use client' 디렉티브가 포함되어야 한다", () => {
      // Assert — Client Component이므로 필수 (localStorage, window 접근)
      expect(source).toMatch(/['"]use client['"]/);
    });
  });

  // ----------------------------------------------------------------
  // 2-2. username/password 폼 제거 확인
  // ----------------------------------------------------------------
  describe('기존 username/password 폼 제거', () => {
    it('username input 필드가 존재하지 않아야 한다', () => {
      // Assert — OIDC 로그인으로 전환 후 username 입력 불필요
      expect(source).not.toMatch(/type=["']text["'].*username|username.*type=["']text["']/);
      expect(source).not.toContain('setUsername');
    });

    it('password input 필드가 존재하지 않아야 한다', () => {
      // Assert — OIDC 로그인으로 전환 후 password 입력 불필요
      expect(source).not.toMatch(/type=["']password["']/);
      expect(source).not.toContain('setPassword');
    });

    it('/api/auth/login POST 호출 로직이 존재하지 않아야 한다', () => {
      // Assert — 기존 username/password 인증 API 엔드포인트 제거
      expect(source).not.toContain('/api/auth/login');
    });
  });

  // ----------------------------------------------------------------
  // 2-3. "로그인" 버튼 → /api/auth/oidc/authorize 이동
  // ----------------------------------------------------------------
  describe('"로그인" 버튼 — OIDC 인증 시작', () => {
    it('"로그인" 텍스트를 가진 버튼이 존재해야 한다', () => {
      // Assert
      expect(source).toContain('로그인');
      expect(source).toMatch(/<button/);
    });

    it('버튼 클릭 시 /api/auth/oidc/authorize 경로로 이동하는 로직이 포함되어야 한다', () => {
      // Assert — window.location.href 또는 router.push로 OIDC 인가 엔드포인트 이동
      expect(source).toContain('/api/auth/oidc/authorize');
    });

    it('window.location.href 또는 window.location.assign을 사용하여 이동해야 한다', () => {
      // Assert — OIDC 인가 엔드포인트는 외부 리다이렉트이므로 window.location 사용이 적절
      const hasLocationHref = source.includes('window.location.href');
      const hasLocationAssign = source.includes('window.location.assign');
      const hasRouterPush = source.includes('router.push') && source.includes('/api/auth/oidc/authorize');
      expect(hasLocationHref || hasLocationAssign || hasRouterPush).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 2-4. ?error 파라미터 감지 및 에러 메시지 표시
  // ----------------------------------------------------------------
  describe('?error 파라미터 감지 및 에러 메시지', () => {
    it('URL searchParams에서 error 파라미터를 읽는 로직이 포함되어야 한다', () => {
      // Assert — useSearchParams 또는 URLSearchParams로 error 파라미터 감지
      const hasSearchParams = source.includes('searchParams') || source.includes('SearchParams');
      const hasUrlSearchParams = source.includes('URLSearchParams');
      expect(hasSearchParams || hasUrlSearchParams).toBe(true);
    });

    it('"로그인에 실패했습니다. 다시 시도해 주세요." 에러 메시지가 포함되어야 한다', () => {
      // Assert — 요구사항에 명시된 정확한 에러 메시지
      expect(source).toContain('로그인에 실패했습니다. 다시 시도해 주세요.');
    });

    it('error 파라미터 유무에 따른 조건부 에러 메시지 렌더링 로직이 있어야 한다', () => {
      // Assert — 조건부 렌더링 패턴 (삼항 연산자 또는 &&)
      const hasConditionalError = source.includes('error') &&
        (source.includes('&&') || source.includes('?'));
      expect(hasConditionalError).toBe(true);
    });

    it('에러 메시지는 접근성 role="alert" 또는 시각적으로 구별 가능한 요소로 표시되어야 한다', () => {
      // Assert — role="alert" 또는 <p>, <div> 등의 에러 컨테이너 존재
      const hasAlert = source.includes('role="alert"') || source.includes("role='alert'");
      const hasErrorElement = source.includes('로그인에 실패했습니다');
      expect(hasAlert || hasErrorElement).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 2-5. localStorage token 확인 → /requests 자동 리다이렉트
  // ----------------------------------------------------------------
  describe('localStorage token 확인 및 자동 리다이렉트', () => {
    it('localStorage에서 token을 읽는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('localStorage');
      expect(source).toContain('token');
    });

    it('localStorage.getItem으로 token을 조회해야 한다', () => {
      // Assert
      expect(source).toContain('getItem');
    });

    it('token이 있는 경우 /requests로 리다이렉트하는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('/requests');
    });

    it('useEffect로 마운트 시 token 존재 여부를 확인해야 한다', () => {
      // Assert — 브라우저 환경에서 마운트 후 localStorage 접근
      expect(source).toContain('useEffect');
    });

    it('next/navigation에서 useRouter를 import해야 한다', () => {
      // Assert — 리다이렉트를 위해 useRouter 필요
      expect(source).toContain('useRouter');
      expect(source).toContain('next/navigation');
    });
  });
});
