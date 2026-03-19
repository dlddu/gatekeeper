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
 *    - token이 있으면 localStorage에 저장 후 /requests로 이동
 *    - token이 없거나 error 파라미터가 있으면 에러 표시 + 로그인 링크
 *    - "인증 처리에 실패했습니다." 에러 메시지
 *    - "로그인 페이지로 돌아가기" 링크 (/login)
 *
 * 테스트 환경: node (Jest 기본 환경, ts-jest)
 * 테스트 방식: 소스 코드 정적 분석 (기존 pages 테스트 패턴 준수)
 *   - app/login/callback/page.tsx는 'use client' 컴포넌트로 localStorage, useSearchParams,
 *     useRouter 등 브라우저 API에 의존합니다.
 *   - Jest testEnvironment가 'node'이고 @testing-library/react가 설치되어 있지 않아
 *     컴포넌트를 직접 렌더링할 수 없습니다.
 *   - 기존 request-detail.test.ts, settings.test.ts와 동일한 정적 분석 패턴을 사용합니다.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const CALLBACK_DIR = path.join(ROOT, 'app', 'login', 'callback');
const PAGE_PATH = path.join(CALLBACK_DIR, 'page.tsx');

// ============================================================
// 섹션 1: 파일 존재 및 App Router 구조 검증
// ============================================================

describe('app/login/callback/page.tsx — 파일 존재 및 구조', () => {
  it('app/login/callback/ 디렉토리가 존재해야 한다', () => {
    // Assert
    expect(fs.existsSync(CALLBACK_DIR)).toBe(true);
    expect(fs.statSync(CALLBACK_DIR).isDirectory()).toBe(true);
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
      // Assert — Client Component이므로 필수 (localStorage, useSearchParams 접근)
      expect(source).toMatch(/['"]use client['"]/);
    });
  });

  // ----------------------------------------------------------------
  // 2-2. URL searchParams에서 token 추출
  // ----------------------------------------------------------------
  describe('URL searchParams에서 token 추출', () => {
    it('searchParams 또는 useSearchParams를 사용하여 URL 파라미터를 읽어야 한다', () => {
      // Assert — OIDC 콜백 URL의 쿼리 파라미터 처리
      const hasSearchParams = source.includes('searchParams') || source.includes('useSearchParams');
      expect(hasSearchParams).toBe(true);
    });

    it('URL 파라미터에서 token을 추출하는 로직이 포함되어야 한다', () => {
      // Assert — ?token=... 파라미터 추출
      expect(source).toContain('token');
      const hasGetToken = source.includes("get('token')") || source.includes('get("token")') ||
        source.includes("searchParams.token") || source.includes('params.token');
      expect(hasGetToken).toBe(true);
    });

    it('URL 파라미터에서 error를 감지하는 로직이 포함되어야 한다', () => {
      // Assert — ?error=... 파라미터 감지
      const hasGetError = source.includes("get('error')") || source.includes('get("error")') ||
        source.includes('searchParams.error') || source.includes("has('error')") ||
        source.includes('has("error")');
      expect(hasGetError).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 2-3. token이 있는 경우: localStorage 저장 후 /requests 이동
  // ----------------------------------------------------------------
  describe('token이 있는 경우 — localStorage 저장 및 /requests 리다이렉트', () => {
    it('localStorage에 token을 저장하는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('localStorage');
      expect(source).toContain('setItem');
    });

    it("localStorage.setItem('token', ...) 형태로 token을 저장해야 한다", () => {
      // Assert — token 키로 저장
      const hasSetItemToken = source.includes("setItem('token'") || source.includes('setItem("token"');
      expect(hasSetItemToken).toBe(true);
    });

    it('token 저장 후 /requests로 이동하는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('/requests');
    });

    it('next/navigation의 useRouter 또는 window.location으로 /requests 이동을 처리해야 한다', () => {
      // Assert — 리다이렉트 수단 확인
      const hasRouter = source.includes('useRouter') || source.includes('router.push') ||
        source.includes('router.replace');
      const hasWindowLocation = source.includes('window.location');
      expect(hasRouter || hasWindowLocation).toBe(true);
    });

    it('useEffect로 마운트 시 token 처리 로직을 실행해야 한다', () => {
      // Assert — 컴포넌트 마운트 후 URL 파라미터 처리
      expect(source).toContain('useEffect');
    });
  });

  // ----------------------------------------------------------------
  // 2-4. token이 없거나 error 파라미터가 있는 경우: 에러 표시
  // ----------------------------------------------------------------
  describe('token 없음 또는 error 파라미터 존재 — 에러 처리', () => {
    it('"인증 처리에 실패했습니다." 에러 메시지가 포함되어야 한다', () => {
      // Assert — 요구사항에 명시된 정확한 에러 메시지
      expect(source).toContain('인증 처리에 실패했습니다.');
    });

    it('"로그인 페이지로 돌아가기" 텍스트가 포함되어야 한다', () => {
      // Assert — 에러 시 사용자가 로그인 페이지로 돌아갈 수 있는 링크
      expect(source).toContain('로그인 페이지로 돌아가기');
    });

    it('/login 경로로 이동하는 링크가 존재해야 한다', () => {
      // Assert — <a href="/login"> 또는 <Link href="/login"> 패턴
      expect(source).toContain('/login');
      const hasLink = source.includes('href="/login"') || source.includes("href='/login'") ||
        source.includes('href={"/login"}') || source.includes("href={'/login'}");
      expect(hasLink).toBe(true);
    });

    it('에러 상태에 따른 조건부 렌더링 로직이 존재해야 한다', () => {
      // Assert — token 유무 또는 error 파라미터에 따른 분기
      const hasConditional = source.includes('!token') || source.includes('error') ||
        source.includes('hasError') || source.includes('isError');
      expect(hasConditional).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 2-5. next/navigation import 확인
  // ----------------------------------------------------------------
  describe('next/navigation 의존성', () => {
    it('next/navigation에서 필요한 훅을 import해야 한다', () => {
      // Assert — useRouter 또는 useSearchParams import
      expect(source).toContain('next/navigation');
    });

    it('useSearchParams 또는 동등한 방법으로 URL 파라미터에 접근해야 한다', () => {
      // Assert
      const hasUseSearchParams = source.includes('useSearchParams');
      const hasSearchParamsAccess = source.includes('searchParams');
      expect(hasUseSearchParams || hasSearchParamsAccess).toBe(true);
    });
  });
});
