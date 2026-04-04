/**
 * e2e/global-setup.ts 단위 테스트
 *
 * DLD-827: Forward Auth 기반으로 변경됨
 * OIDC Mock 서버 관련 테스트는 제거되었습니다.
 */

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
// 테스트 대상 import
// ----------------------------------------------------------------
import globalSetup from '../e2e/global-setup';

// ----------------------------------------------------------------
// 테스트 스위트
// ----------------------------------------------------------------

describe('e2e/global-setup.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpsert.mockResolvedValue({ id: 'mock-id' });
    mockFindUnique.mockResolvedValue({ id: 'mock-admin-id' });
    mockDisconnect.mockResolvedValue(undefined);
  });

  describe('모듈 export 확인', () => {
    it('globalSetup 함수를 default export해야 한다', () => {
      expect(typeof globalSetup).toBe('function');
    });

    it('globalSetup은 Promise를 반환해야 한다', async () => {
      const result = globalSetup();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });

  describe('시드 데이터 삽입', () => {
    it('globalSetup 실행 시 user.upsert를 호출해야 한다', async () => {
      await globalSetup();
      expect(mockUpsert).toHaveBeenCalled();
    });

    it('시드 데이터에 admin 사용자가 포함되어야 한다', async () => {
      await globalSetup();
      const upsertCalls = mockUpsert.mock.calls;
      const adminUpsert = upsertCalls.find(
        (call) => call[0]?.where?.username === 'admin'
      );
      expect(adminUpsert).toBeDefined();
    });

    it('시드 데이터에 autheliaId 필드가 사용되어야 한다', async () => {
      await globalSetup();
      const upsertCalls = mockUpsert.mock.calls;
      const userWithAutheliaId = upsertCalls.find(
        (call) => call[0]?.create?.autheliaId !== undefined
      );
      expect(userWithAutheliaId).toBeDefined();
    });
  });
});
