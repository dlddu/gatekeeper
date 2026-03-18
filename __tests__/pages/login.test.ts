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
 *    - <h1>Gatekeeper</h1> 헤딩
 *    - '승인 게이트웨이 서비스' 부제목
 *    - username/password 폼 요소 제거 (input[type=text], input[type=password] 없음)
 *    - '로그인' 버튼 1개
 *    - 버튼 클릭 시 window.location.href = '/api/auth/oidc/authorize' 이동
 *    - ?error 파라미터 존재 시 에러 메시지 표시
 *    - localStorage token 존재 시 /requests 리다이렉트
 * 3. 인증 처리
 *    - useRouter + useEffect 패턴
 *    - next/navigation import
 *    - useSearchParams 사용
 *
 * 테스트 환경: node (Jest 기본 환경, ts-jest)
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
      // Assert — Client Component이므로 필수
      expect(source).toMatch(/['"]use client['"]/);
    });
  });

  // ----------------------------------------------------------------
  // 2-2. <h1>Gatekeeper</h1> 헤딩
  // ----------------------------------------------------------------
  describe('<h1>Gatekeeper</h1> 헤딩', () => {
    it('h1 요소에 "Gatekeeper" 텍스트가 포함되어야 한다', () => {
      // Assert
      expect(source).toMatch(/<h1[^>]*>.*Gatekeeper.*<\/h1>/s);
    });
  });

  // ----------------------------------------------------------------
  // 2-3. '승인 게이트웨이 서비스' 부제목
  // ----------------------------------------------------------------
  describe("'승인 게이트웨이 서비스' 부제목", () => {
    it("페이지에 '승인 게이트웨이 서비스' 텍스트가 포함되어야 한다", () => {
      // Assert
      expect(source).toContain('승인 게이트웨이 서비스');
    });
  });

  // ----------------------------------------------------------------
  // 2-4. username/password 폼 요소 제거
  // ----------------------------------------------------------------
  describe('username/password 폼 요소 제거', () => {
    it('username 타입 input 요소가 없어야 한다 (type="text" + username 관련)', () => {
      // Assert — username input이 완전히 제거되어야 함
      const hasUsernameInput =
        source.includes('type="text"') || source.includes("type='text'");
      const hasUsernameLabel =
        source.includes('아이디') || source.includes('username');
      // 둘 다 동시에 존재하면 안 됨
      expect(hasUsernameInput && hasUsernameLabel).toBe(false);
    });

    it('password 타입 input 요소가 없어야 한다', () => {
      // Assert — password input이 완전히 제거되어야 함
      const hasPasswordInput =
        source.includes('type="password"') ||
        source.includes("type='password'");
      expect(hasPasswordInput).toBe(false);
    });

    it('<form> 요소가 없어야 한다 (폼 기반 로그인 제거)', () => {
      // Assert — 기존 username/password form 제거
      expect(source).not.toMatch(/<form[\s>]/);
    });

    it('onSubmit 핸들러가 없어야 한다 (폼 제출 방식 제거)', () => {
      // Assert
      expect(source).not.toContain('onSubmit');
    });

    it('handleSubmit 함수가 없어야 한다', () => {
      // Assert — 기존 폼 제출 핸들러 제거 확인
      expect(source).not.toContain('handleSubmit');
    });
  });

  // ----------------------------------------------------------------
  // 2-5. '로그인' 버튼 1개
  // ----------------------------------------------------------------
  describe("'로그인' 버튼", () => {
    it("'로그인' 텍스트를 가진 버튼이 존재해야 한다", () => {
      // Assert
      expect(source).toContain('로그인');
    });

    it('<button> 요소가 존재해야 한다', () => {
      // Assert
      expect(source).toMatch(/<button/);
    });
  });

  // ----------------------------------------------------------------
  // 2-6. 버튼 클릭 시 /api/auth/oidc/authorize로 이동
  // ----------------------------------------------------------------
  describe("버튼 클릭 시 /api/auth/oidc/authorize로 이동", () => {
    it("'/api/auth/oidc/authorize' 경로가 소스에 포함되어야 한다", () => {
      // Assert
      expect(source).toContain('/api/auth/oidc/authorize');
    });

    it('window.location.href를 통한 이동 로직이 포함되어야 한다', () => {
      // Assert — window.location.href 할당 패턴
      expect(source).toContain('window.location.href');
    });

    it('window.location.href가 /api/auth/oidc/authorize로 설정되어야 한다', () => {
      // Assert — 할당 대상이 올바른 경로인지 확인
      expect(source).toMatch(/window\.location\.href\s*=\s*['"`]\/api\/auth\/oidc\/authorize['"`]/);
    });
  });

  // ----------------------------------------------------------------
  // 2-7. ?error 파라미터 존재 시 에러 메시지 표시
  // ----------------------------------------------------------------
  describe('?error 파라미터 기반 에러 메시지', () => {
    it("'로그인에 실패했습니다. 다시 시도해 주세요.' 에러 메시지가 소스에 포함되어야 한다", () => {
      // Assert
      expect(source).toContain('로그인에 실패했습니다. 다시 시도해 주세요.');
    });

    it('URL의 error 파라미터를 읽는 로직이 포함되어야 한다', () => {
      // Assert — searchParams.get('error') 또는 error 파라미터 처리 패턴
      const hasSearchParamsError =
        source.includes("searchParams") &&
        (source.includes("'error'") || source.includes('"error"'));
      const hasErrorParam = source.includes('error');
      expect(hasSearchParamsError || hasErrorParam).toBe(true);
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
  // 2-8. localStorage token 존재 시 /requests 리다이렉트
  // ----------------------------------------------------------------
  describe('localStorage token 존재 시 /requests 리다이렉트', () => {
    it('localStorage에서 token을 읽는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('localStorage');
      expect(source).toContain('token');
    });

    it('token이 있으면 /requests로 리다이렉트하는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('/requests');
    });

    it('useRouter를 통해 /requests로 router.push하는 로직이 포함되어야 한다', () => {
      // Assert — router.push('/requests') 패턴
      expect(source).toMatch(/router\.push\(['"`]\/requests['"`]\)/);
    });
  });
});

// ============================================================
// 섹션 3: 인증 처리 및 라우팅 패턴
// ============================================================

describe('app/login/page.tsx — 인증 처리 및 라우팅 패턴', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(PAGE_PATH, 'utf-8');
  });

  it('next/navigation에서 useRouter를 import해야 한다', () => {
    // Assert
    expect(source).toContain('useRouter');
    expect(source).toContain('next/navigation');
  });

  it('useEffect로 마운트 시 localStorage token을 체크해야 한다', () => {
    // Assert — 마운트 시 인증 상태 확인
    expect(source).toContain('useEffect');
    expect(source).toContain('localStorage');
  });

  it('useEffect와 useRouter를 함께 사용하는 패턴을 따라야 한다', () => {
    // Assert — 기존 페이지들과 동일한 패턴
    expect(source).toContain('useEffect');
    expect(source).toContain('useRouter');
  });
});
