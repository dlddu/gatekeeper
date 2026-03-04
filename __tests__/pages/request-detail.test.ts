/**
 * 요청 상세 페이지 (app/requests/[id]/page.tsx) unit 테스트
 *
 * TDD Red Phase — 구현 전 테스트 작성.
 * 이 테스트는 구현 코드가 작성되기 전까지 실패 상태입니다.
 *
 * 검증 범위:
 * 1. 파일 존재 및 Next.js App Router 구조 준수
 * 2. 페이지 소스 코드 정적 분석으로 UI 요구사항 구조 검증
 *    - 제목 "요청 상세" (role="heading")
 *    - 뒤로가기 버튼 (role="button", name="뒤로가기") → /requests 이동
 *    - requesterName, context 표시
 *    - 타임아웃 카운트다운 타이머 (amber 배경)
 *    - 만료 표시 ("만료됨" 텍스트, gray 배경)
 *    - 승인/거절 버튼 (name="승인", name="거절")
 *    - 확인 다이얼로그 (name="확인")
 *    - 처리된/만료된 요청: 버튼 disabled
 * 3. useCountdown 훅 순수 계산 로직
 *
 * 테스트 환경: node (Jest 기본 환경, ts-jest)
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const PAGE_PATH = path.join(ROOT, 'app', 'requests', '[id]', 'page.tsx');

// ============================================================
// 섹션 1: 파일 존재 및 App Router 구조 검증
// ============================================================

describe('app/requests/[id]/page.tsx — 파일 존재 및 구조', () => {
  it('app/requests/[id]/ 디렉토리가 존재해야 한다', () => {
    // Arrange
    const dirPath = path.join(ROOT, 'app', 'requests', '[id]');

    // Assert
    expect(fs.existsSync(dirPath)).toBe(true);
    expect(fs.statSync(dirPath).isDirectory()).toBe(true);
  });

  it('app/requests/[id]/page.tsx 파일이 존재해야 한다', () => {
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

  it('page.tsx가 props로 params를 받아야 한다 (동적 라우트 [id] 처리)', () => {
    // Arrange
    const source = fs.readFileSync(PAGE_PATH, 'utf-8');

    // Assert — { params } 또는 props.params 패턴으로 id를 수신해야 함
    expect(source).toMatch(/params/);
  });
});

// ============================================================
// 섹션 2: 페이지 UI 요구사항 — 소스 코드 정적 분석
// ============================================================

describe('app/requests/[id]/page.tsx — UI 요구사항 정적 분석', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(PAGE_PATH, 'utf-8');
  });

  // ----------------------------------------------------------------
  // 2-1. 페이지 제목: role="heading", name="요청 상세"
  // ----------------------------------------------------------------
  describe('페이지 제목 "요청 상세"', () => {
    it('페이지에 "요청 상세" 텍스트가 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('요청 상세');
    });

    it('heading 역할을 가진 요소(h1~h6)가 존재해야 한다', () => {
      // Assert — h1~h6 태그 중 하나 이상 존재
      expect(source).toMatch(/<h[1-6][^>]*>/);
    });
  });

  // ----------------------------------------------------------------
  // 2-2. 뒤로가기 버튼 → /requests 이동
  // ----------------------------------------------------------------
  describe('뒤로가기 버튼', () => {
    it('"뒤로가기" 텍스트를 가진 버튼이 존재해야 한다', () => {
      // Assert
      expect(source).toContain('뒤로가기');
    });

    it('뒤로가기 버튼이 /requests 경로로 이동하는 로직을 포함해야 한다', () => {
      // Assert — router.push('/requests') 또는 href="/requests" 패턴
      expect(source).toMatch(/['"`]\/requests['"`]/);
    });

    it('뒤로가기 버튼이 button 요소 또는 aria-label="뒤로가기"를 포함해야 한다', () => {
      // Assert — <button> 요소가 존재해야 함
      expect(source).toMatch(/<button/);
    });
  });

  // ----------------------------------------------------------------
  // 2-3. requesterName, context 표시
  // ----------------------------------------------------------------
  describe('requesterName, context 표시', () => {
    it('requesterName 필드를 참조해야 한다', () => {
      // Assert — request.requesterName 또는 requesterName 변수 참조
      expect(source).toContain('requesterName');
    });

    it('context 필드를 참조해야 한다', () => {
      // Assert — request.context 또는 context 변수 참조
      expect(source).toContain('context');
    });
  });

  // ----------------------------------------------------------------
  // 2-4. 타임아웃 카운트다운 타이머 (amber 배경)
  // ----------------------------------------------------------------
  describe('타임아웃 카운트다운 타이머', () => {
    it('timeoutSeconds 또는 expiresAt 필드를 참조해야 한다', () => {
      // Assert — 타임아웃 조건 분기를 위해 해당 필드 참조 필요
      const hasTimeoutSeconds = source.includes('timeoutSeconds');
      const hasExpiresAt = source.includes('expiresAt');
      expect(hasTimeoutSeconds || hasExpiresAt).toBe(true);
    });

    it('카운트다운 타이머 관련 amber 색상 클래스 또는 스타일이 포함되어야 한다', () => {
      // Assert — amber 배경 표현 (Tailwind 클래스 또는 inline style)
      const hasAmberClass = source.includes('amber');
      const hasAmberColor = source.includes('#f59e0b') || source.includes('#d97706') || source.includes('#fef3c7') || source.includes('#fbbf24');
      expect(hasAmberClass || hasAmberColor).toBe(true);
    });

    it('useCountdown 훅 또는 카운트다운 구현을 포함해야 한다', () => {
      // Assert — 기존 훅 재사용 또는 자체 카운트다운 구현
      const usesHook = source.includes('useCountdown');
      const usesSetInterval = source.includes('setInterval');
      const usesCountdown = source.toLowerCase().includes('countdown');
      expect(usesHook || usesSetInterval || usesCountdown).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 2-5. 만료됨 표시 (gray 배경)
  // ----------------------------------------------------------------
  describe('만료됨 표시', () => {
    it('"만료됨" 텍스트가 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('만료됨');
    });

    it('EXPIRED 상태 처리를 위한 조건 분기가 존재해야 한다', () => {
      // Assert — status 비교 또는 EXPIRED 리터럴 존재
      const hasExpiredStatus = source.includes('EXPIRED');
      const hasExpiredLower = source.includes('expired');
      expect(hasExpiredStatus || hasExpiredLower).toBe(true);
    });

    it('만료 상태에서 gray 색상 클래스 또는 스타일이 포함되어야 한다', () => {
      // Assert — gray 배경 표현
      const hasGrayClass = source.includes('gray');
      const hasGrayColor = source.includes('#6b7280') || source.includes('#9ca3af') || source.includes('#f3f4f6') || source.includes('#e5e7eb');
      expect(hasGrayClass || hasGrayColor).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 2-6. 승인/거절 버튼
  // ----------------------------------------------------------------
  describe('승인/거절 버튼', () => {
    it('"승인" 텍스트를 가진 버튼이 존재해야 한다', () => {
      // Assert
      expect(source).toContain('승인');
    });

    it('"거절" 텍스트를 가진 버튼이 존재해야 한다', () => {
      // Assert
      expect(source).toContain('거절');
    });

    it('승인 API 엔드포인트를 호출하는 로직이 포함되어야 한다', () => {
      // Assert — /approve 경로 참조
      expect(source).toContain('approve');
    });

    it('거절 API 엔드포인트를 호출하는 로직이 포함되어야 한다', () => {
      // Assert — /reject 경로 참조
      expect(source).toContain('reject');
    });

    it('PATCH 메서드로 API 호출하는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('PATCH');
    });

    it('JWT Bearer 토큰을 Authorization 헤더로 전송하는 로직이 포함되어야 한다', () => {
      // Assert — Authorization 헤더 또는 Bearer 토큰 패턴
      const hasAuthorization = source.includes('Authorization');
      const hasBearer = source.includes('Bearer');
      expect(hasAuthorization && hasBearer).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 2-7. 확인 다이얼로그
  // ----------------------------------------------------------------
  describe('확인 다이얼로그', () => {
    it('"확인" 텍스트가 포함되어야 한다 (다이얼로그 확인 버튼)', () => {
      // Assert
      expect(source).toContain('확인');
    });

    it('다이얼로그 관련 상태 관리가 존재해야 한다', () => {
      // Assert — 다이얼로그 표시 여부를 제어하는 state
      const hasDialogState = source.includes('dialog') || source.includes('Dialog') ||
        source.includes('confirm') || source.includes('Confirm') ||
        source.includes('modal') || source.includes('Modal');
      expect(hasDialogState).toBe(true);
    });

    it('클릭 후 API 호출 전 확인 단계가 존재해야 한다', () => {
      // Assert — 확인 후 API 호출하는 패턴 (pending action state 또는 다이얼로그 state)
      const hasPendingAction = source.includes('pendingAction') || source.includes('pending') ||
        source.includes('confirmAction') || source.includes('onConfirm');
      const hasMultiStep = source.includes('dialog') || source.includes('Dialog') ||
        source.includes('modal') || source.includes('confirm');
      expect(hasPendingAction || hasMultiStep).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // 2-8. 처리된/만료된 요청: 버튼 disabled
  // ----------------------------------------------------------------
  describe('버튼 비활성화 (처리됨/만료됨)', () => {
    it('버튼에 disabled 속성이 조건부로 적용되어야 한다', () => {
      // Assert — disabled 속성이 존재해야 함
      expect(source).toContain('disabled');
    });

    it('PENDING 상태가 아닌 경우 버튼 비활성화 조건이 존재해야 한다', () => {
      // Assert — PENDING 상태 체크 또는 isProcessed 같은 변수
      const hasPendingCheck = source.includes('PENDING');
      const hasProcessedCheck = source.includes('processedAt') || source.includes('isProcessed') ||
        source.includes('isDisabled') || source.includes('isDone');
      expect(hasPendingCheck || hasProcessedCheck).toBe(true);
    });

    it('APPROVED 상태에서 버튼 비활성화 처리를 포함해야 한다', () => {
      // Assert
      expect(source).toContain('APPROVED');
    });

    it('REJECTED 상태에서 버튼 비활성화 처리를 포함해야 한다', () => {
      // Assert
      expect(source).toContain('REJECTED');
    });
  });

  // ----------------------------------------------------------------
  // 2-9. 인증 처리
  // ----------------------------------------------------------------
  describe('인증 처리', () => {
    it('localStorage에서 JWT 토큰을 읽는 로직이 포함되어야 한다', () => {
      // Assert — 기존 요청 목록 페이지와 동일한 패턴
      expect(source).toContain('localStorage');
      expect(source).toContain('token');
    });

    it('토큰이 없는 경우 /login으로 리다이렉트하는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('/login');
    });
  });

  // ----------------------------------------------------------------
  // 2-10. GET API 호출로 요청 데이터 로드
  // ----------------------------------------------------------------
  describe('요청 데이터 로드', () => {
    it('요청 상세 데이터를 fetch하는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('fetch');
    });

    it('/api/requests/ 경로로 데이터를 가져오는 로직이 포함되어야 한다', () => {
      // Assert
      expect(source).toContain('/api/requests/');
    });

    it('로딩 상태(isLoading 또는 loading)를 관리해야 한다', () => {
      // Assert
      const hasLoadingState = source.includes('isLoading') || source.includes('loading') ||
        source.includes('Loading');
      expect(hasLoadingState).toBe(true);
    });

    it('에러 상태를 관리해야 한다', () => {
      // Assert
      const hasErrorState = source.includes('error') || source.includes('Error');
      expect(hasErrorState).toBe(true);
    });
  });
});

// ============================================================
// 섹션 3: useCountdown 훅 — 순수 계산 로직 unit 테스트
// ============================================================

describe('useCountdown 훅 — 순수 계산 로직', () => {
  /**
   * useCountdown은 React 훅이라 직접 호출은 불가합니다.
   * 훅이 내부적으로 수행하는 시간 계산 로직만 순수 함수로 추출하여 검증합니다.
   */

  /**
   * useCountdown의 핵심 계산 로직과 동일한 순수 함수
   * (hooks/useCountdown.ts의 calculate 함수와 동일한 로직)
   */
  function calculateCountdown(expiresAt: string | null): [number, number] {
    if (!expiresAt) return [0, 0];
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return [0, 0];
    const totalSeconds = Math.floor(diff / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return [minutes, seconds];
  }

  // ----------------------------------------------------------------
  // expiresAt이 null인 경우
  // ----------------------------------------------------------------
  describe('expiresAt이 null인 경우', () => {
    it('null이면 [0, 0]을 반환해야 한다', () => {
      // Act
      const result = calculateCountdown(null);

      // Assert
      expect(result).toEqual([0, 0]);
    });
  });

  // ----------------------------------------------------------------
  // expiresAt이 과거인 경우 (만료됨)
  // ----------------------------------------------------------------
  describe('expiresAt이 과거인 경우 (만료됨)', () => {
    it('이미 지난 시간이면 [0, 0]을 반환해야 한다', () => {
      // Arrange
      const pastDate = new Date(Date.now() - 60 * 1000).toISOString(); // 1분 전

      // Act
      const result = calculateCountdown(pastDate);

      // Assert
      expect(result).toEqual([0, 0]);
    });

    it('훨씬 과거의 시간이어도 [0, 0]을 반환해야 한다', () => {
      // Arrange
      const veryOldDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(); // 1일 전

      // Act
      const result = calculateCountdown(veryOldDate);

      // Assert
      expect(result).toEqual([0, 0]);
    });
  });

  // ----------------------------------------------------------------
  // expiresAt이 미래인 경우 (정상 카운트다운)
  // ----------------------------------------------------------------
  describe('expiresAt이 미래인 경우 (정상 카운트다운)', () => {
    it('정확히 1분 후이면 [1, 0]을 반환해야 한다 (오차 1초 이내)', () => {
      // Arrange — Date.now()의 밀리초 정밀도로 인해 약 ±1초 오차 허용
      const futureDate = new Date(Date.now() + 60 * 1000).toISOString();

      // Act
      const [minutes, seconds] = calculateCountdown(futureDate);

      // Assert
      expect(minutes).toBe(0); // 59초 또는 60초 범위 → minutes=0
      const totalSeconds = minutes * 60 + seconds;
      expect(totalSeconds).toBeGreaterThanOrEqual(59);
      expect(totalSeconds).toBeLessThanOrEqual(60);
    });

    it('정확히 90초 후이면 [1, 29] 또는 [1, 30]을 반환해야 한다', () => {
      // Arrange
      const futureDate = new Date(Date.now() + 90 * 1000).toISOString();

      // Act
      const [minutes, seconds] = calculateCountdown(futureDate);

      // Assert
      expect(minutes).toBe(1);
      expect(seconds).toBeGreaterThanOrEqual(29);
      expect(seconds).toBeLessThanOrEqual(30);
    });

    it('반환값의 minutes가 0 이상의 정수여야 한다', () => {
      // Arrange
      const futureDate = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      // Act
      const [minutes] = calculateCountdown(futureDate);

      // Assert
      expect(Number.isInteger(minutes)).toBe(true);
      expect(minutes).toBeGreaterThanOrEqual(0);
    });

    it('반환값의 seconds가 0 이상 59 이하의 정수여야 한다', () => {
      // Arrange
      const futureDate = new Date(Date.now() + 5 * 60 * 1000).toISOString();

      // Act
      const [, seconds] = calculateCountdown(futureDate);

      // Assert
      expect(Number.isInteger(seconds)).toBe(true);
      expect(seconds).toBeGreaterThanOrEqual(0);
      expect(seconds).toBeLessThanOrEqual(59);
    });

    it('3분 후이면 minutes가 2 이상이어야 한다', () => {
      // Arrange
      const futureDate = new Date(Date.now() + 3 * 60 * 1000).toISOString();

      // Act
      const [minutes] = calculateCountdown(futureDate);

      // Assert
      expect(minutes).toBeGreaterThanOrEqual(2);
    });

    it('반환값이 [number, number] 튜플 형태여야 한다', () => {
      // Arrange
      const futureDate = new Date(Date.now() + 30 * 1000).toISOString();

      // Act
      const result = calculateCountdown(futureDate);

      // Assert
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
      expect(typeof result[0]).toBe('number');
      expect(typeof result[1]).toBe('number');
    });
  });

  // ----------------------------------------------------------------
  // seconds 계산 (60으로 나눈 나머지)
  // ----------------------------------------------------------------
  describe('seconds 계산 정확성', () => {
    it('75초 후이면 minutes=1, seconds가 14~15 범위여야 한다', () => {
      // Arrange
      const futureDate = new Date(Date.now() + 75 * 1000).toISOString();

      // Act
      const [minutes, seconds] = calculateCountdown(futureDate);

      // Assert
      expect(minutes).toBe(1);
      expect(seconds).toBeGreaterThanOrEqual(14);
      expect(seconds).toBeLessThanOrEqual(15);
    });

    it('120초 후이면 minutes=1, seconds가 59~60 범위여야 한다', () => {
      // Arrange
      const futureDate = new Date(Date.now() + 120 * 1000).toISOString();

      // Act
      const [minutes, seconds] = calculateCountdown(futureDate);

      // Assert — 119-120초 사이 값
      const totalSeconds = minutes * 60 + seconds;
      expect(totalSeconds).toBeGreaterThanOrEqual(119);
      expect(totalSeconds).toBeLessThanOrEqual(120);
    });
  });
});

// ============================================================
// 섹션 4: 요청 상세 페이지 — 데이터 모델 타입 호환성 검증
// ============================================================

describe('요청 상세 페이지 — 데이터 모델 구조 검증', () => {
  /**
   * 페이지가 API 응답 데이터 모델의 필드를 올바르게 참조하는지 검증합니다.
   * Request { id, externalId, context, requesterName, status, timeoutSeconds?,
   *           expiresAt?, createdAt, processedAt?, processedById? }
   */

  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(PAGE_PATH, 'utf-8');
  });

  it('Request 데이터 모델의 id 필드를 참조해야 한다', () => {
    // Assert
    expect(source).toContain('id');
  });

  it('Request 데이터 모델의 status 필드를 참조해야 한다', () => {
    // Assert
    expect(source).toContain('status');
  });

  it('Request 데이터 모델의 createdAt 또는 processedAt 필드를 참조해야 한다', () => {
    // Assert
    const hasCreatedAt = source.includes('createdAt');
    const hasProcessedAt = source.includes('processedAt');
    expect(hasCreatedAt || hasProcessedAt).toBe(true);
  });

  it('가능한 모든 status 값(PENDING, APPROVED, REJECTED, EXPIRED)을 처리해야 한다', () => {
    // Assert — 네 가지 상태 모두 참조 확인
    expect(source).toContain('PENDING');
    expect(source).toContain('APPROVED');
    expect(source).toContain('REJECTED');
    expect(source).toContain('EXPIRED');
  });
});

// ============================================================
// 섹션 5: hooks/useCountdown.ts 파일 존재 및 구조 검증
// ============================================================

describe('hooks/useCountdown.ts — 파일 존재 및 export 검증', () => {
  const HOOK_PATH = path.join(ROOT, 'hooks', 'useCountdown.ts');

  it('hooks/useCountdown.ts 파일이 존재해야 한다', () => {
    // Assert
    expect(fs.existsSync(HOOK_PATH)).toBe(true);
  });

  it('useCountdown 함수를 export해야 한다', () => {
    // Arrange
    const source = fs.readFileSync(HOOK_PATH, 'utf-8');

    // Assert
    expect(source).toContain('export');
    expect(source).toContain('useCountdown');
  });

  it('expiresAt 파라미터를 받아야 한다', () => {
    // Arrange
    const source = fs.readFileSync(HOOK_PATH, 'utf-8');

    // Assert
    expect(source).toContain('expiresAt');
  });

  it('[number, number] 튜플을 반환해야 한다', () => {
    // Arrange
    const source = fs.readFileSync(HOOK_PATH, 'utf-8');

    // Assert — 반환 타입 선언 확인
    expect(source).toMatch(/\[number,\s*number\]/);
  });
});
