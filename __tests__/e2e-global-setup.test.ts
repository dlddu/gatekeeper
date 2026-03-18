/**
 * e2e/global-setup.ts 단위 테스트
 *
 * DLD-795: e2e global-setup에 OIDC Mock 서버 통합
 *
 * 검증 범위:
 * - globalSetup 실행 시 startOidcMockServer(9999) 호출 여부
 * - globalSetup 실행 시 OIDC 테스트 사용자(oidc-user)가 시드 데이터에 포함되는지 여부
 * - startOidcMockServer 호출이 seedDatabase 호출보다 먼저 이루어지는지 여부
 * - OIDC mock 서버 시작 실패 시 globalSetup도 실패하는지 여부
 *
 * 참고:
 * - global-setup/teardown은 Playwright가 호출하는 함수이므로 직접 import하여 단위 테스트
 * - startOidcMockServer/stopOidcMockServer는 mock하여 포트 충돌 방지
 * - 실제 서버 동작 검증은 __tests__/oidc-mock.test.ts에서 수행
 */

// ----------------------------------------------------------------
// oidc-mock 모듈 전체를 mock 처리 (포트 충돌 방지)
// ----------------------------------------------------------------
jest.mock('../e2e/helpers/oidc-mock', () => ({
  startOidcMockServer: jest.fn().mockResolvedValue(undefined),
  stopOidcMockServer: jest.fn().mockResolvedValue(undefined),
}));

// ----------------------------------------------------------------
// child_process mock (execSync — Prisma db push 호출 방지)
// ----------------------------------------------------------------
jest.mock('child_process', () => ({
  execSync: jest.fn(),
}));

// ----------------------------------------------------------------
// fs mock (DB 파일 존재 여부 체크 우회)
// ----------------------------------------------------------------
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(false),
  unlinkSync: jest.fn(),
}));

// ----------------------------------------------------------------
// @prisma/client + @prisma/adapter-libsql mock (DB 조작 방지)
// ----------------------------------------------------------------
const mockUpsert = jest.fn().mockResolvedValue({ id: 'mock-id' });
const mockFindUnique = jest.fn().mockResolvedValue({ id: 'mock-admin-id' });
const mockDisconnect = jest.fn().mockResolvedValue(undefined);

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      upsert: mockUpsert,
      findUnique: mockFindUnique,
    },
    request: {
      upsert: mockUpsert,
    },
    $disconnect: mockDisconnect,
  })),
}));

jest.mock('@prisma/adapter-libsql', () => ({
  PrismaLibSql: jest.fn().mockImplementation(() => ({})),
}));

// ----------------------------------------------------------------
// bcryptjs mock (해시 연산 방지)
// ----------------------------------------------------------------
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$2a$10$mockedhash'),
}));

// ----------------------------------------------------------------
// 테스트 대상 import
// 구현이 완료되지 않은 경우 이 import는 실패합니다 (TDD Red Phase)
// ----------------------------------------------------------------
import globalSetup from '../e2e/global-setup';
import {
  startOidcMockServer,
  stopOidcMockServer,
} from '../e2e/helpers/oidc-mock';

// ----------------------------------------------------------------
// 테스트 스위트
// ----------------------------------------------------------------

describe('e2e/global-setup.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // 기본 mock 반환값 재설정
    (startOidcMockServer as jest.Mock).mockResolvedValue(undefined);
    mockUpsert.mockResolvedValue({ id: 'mock-id' });
    mockFindUnique.mockResolvedValue({ id: 'mock-admin-id' });
    mockDisconnect.mockResolvedValue(undefined);
  });

  // ----------------------------------------------------------------
  // export 확인
  // ----------------------------------------------------------------
  describe('모듈 export 확인', () => {
    it('globalSetup 함수를 default export해야 한다', () => {
      // Assert
      expect(typeof globalSetup).toBe('function');
    });

    it('globalSetup은 Promise를 반환해야 한다', async () => {
      // Act
      const result = globalSetup();

      // Assert
      expect(result).toBeInstanceOf(Promise);

      await result;
    });
  });

  // ----------------------------------------------------------------
  // OIDC Mock 서버 시작
  // ----------------------------------------------------------------
  describe('OIDC Mock 서버 시작', () => {
    it('globalSetup 실행 시 startOidcMockServer를 호출해야 한다', async () => {
      // Act
      await globalSetup();

      // Assert
      expect(startOidcMockServer).toHaveBeenCalled();
    });

    it('startOidcMockServer를 포트 9999로 호출해야 한다', async () => {
      // Act
      await globalSetup();

      // Assert
      expect(startOidcMockServer).toHaveBeenCalledWith(9999);
    });

    it('startOidcMockServer는 정확히 1번만 호출되어야 한다', async () => {
      // Act
      await globalSetup();

      // Assert
      expect(startOidcMockServer).toHaveBeenCalledTimes(1);
    });

    it('stopOidcMockServer는 globalSetup에서 호출되지 않아야 한다', async () => {
      // Act
      await globalSetup();

      // Assert
      expect(stopOidcMockServer).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // 호출 순서: OIDC 서버 시작 → 시드 데이터 삽입
  // ----------------------------------------------------------------
  describe('실행 순서', () => {
    it('startOidcMockServer가 user.upsert보다 먼저 호출되어야 한다', async () => {
      // Arrange
      const callOrder: string[] = [];

      (startOidcMockServer as jest.Mock).mockImplementation(async () => {
        callOrder.push('startOidcMockServer');
      });
      mockUpsert.mockImplementation(async () => {
        callOrder.push('upsert');
        return { id: 'mock-id' };
      });

      // Act
      await globalSetup();

      // Assert
      const startIndex = callOrder.indexOf('startOidcMockServer');
      const firstUpsertIndex = callOrder.indexOf('upsert');

      expect(startIndex).toBeGreaterThanOrEqual(0);
      expect(firstUpsertIndex).toBeGreaterThan(startIndex);
    });
  });

  // ----------------------------------------------------------------
  // OIDC 테스트 사용자 시드 데이터
  // ----------------------------------------------------------------
  describe('시드 데이터: OIDC 테스트 사용자', () => {
    it('시드 데이터에 OIDC 테스트 사용자 upsert를 호출해야 한다', async () => {
      // Act
      await globalSetup();

      // Assert — user.upsert 호출 중 OIDC 관련 사용자가 포함되어야 함
      const upsertCalls = mockUpsert.mock.calls;
      const userUpsertCalls = upsertCalls.filter(
        (call) =>
          call[0]?.where?.username !== undefined ||
          call[0]?.create?.oidcSub !== undefined
      );

      expect(userUpsertCalls.length).toBeGreaterThan(0);
    });

    it('OIDC 사용자 생성 시 oidcSub 필드가 설정되어야 한다', async () => {
      // Act
      await globalSetup();

      // Assert — oidcSub 필드가 포함된 upsert 호출이 있어야 함
      const upsertCalls = mockUpsert.mock.calls;
      const oidcUserUpsert = upsertCalls.find(
        (call) => call[0]?.create?.oidcSub !== undefined
      );

      expect(oidcUserUpsert).toBeDefined();
      expect(typeof oidcUserUpsert![0].create.oidcSub).toBe('string');
      expect(oidcUserUpsert![0].create.oidcSub.length).toBeGreaterThan(0);
    });

    it('OIDC 사용자 생성 시 username 필드가 설정되어야 한다', async () => {
      // Act
      await globalSetup();

      // Assert
      const upsertCalls = mockUpsert.mock.calls;
      const oidcUserUpsert = upsertCalls.find(
        (call) => call[0]?.create?.oidcSub !== undefined
      );

      expect(oidcUserUpsert).toBeDefined();
      expect(typeof oidcUserUpsert![0].create.username).toBe('string');
      expect(oidcUserUpsert![0].create.username.length).toBeGreaterThan(0);
    });

    it('OIDC 사용자 생성 시 displayName 필드가 설정되어야 한다', async () => {
      // Act
      await globalSetup();

      // Assert
      const upsertCalls = mockUpsert.mock.calls;
      const oidcUserUpsert = upsertCalls.find(
        (call) => call[0]?.create?.oidcSub !== undefined
      );

      expect(oidcUserUpsert).toBeDefined();
      expect(typeof oidcUserUpsert![0].create.displayName).toBe('string');
      expect(oidcUserUpsert![0].create.displayName.length).toBeGreaterThan(0);
    });
  });

  // ----------------------------------------------------------------
  // 에러 처리
  // ----------------------------------------------------------------
  describe('에러 처리', () => {
    it('startOidcMockServer가 실패하면 globalSetup도 실패해야 한다', async () => {
      // Arrange
      const mockError = new Error('포트 9999 바인딩 실패');
      (startOidcMockServer as jest.Mock).mockRejectedValue(mockError);

      // Act & Assert
      await expect(globalSetup()).rejects.toThrow('포트 9999 바인딩 실패');
    });

    it('startOidcMockServer 실패 시 시드 데이터 삽입이 수행되지 않아야 한다', async () => {
      // Arrange
      (startOidcMockServer as jest.Mock).mockRejectedValue(
        new Error('서버 시작 실패')
      );

      // Act
      await expect(globalSetup()).rejects.toThrow();

      // Assert — 시드 데이터 upsert가 호출되지 않아야 함
      expect(mockUpsert).not.toHaveBeenCalled();
    });
  });
});
