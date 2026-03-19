/**
 * e2e/global-teardown.ts 단위 테스트
 *
 * DLD-827: Forward Auth 기반으로 변경됨
 * OIDC Mock 서버 관련 테스트는 제거되었습니다.
 */

// ----------------------------------------------------------------
// fs mock (파일 존재 여부 체크 + 삭제 동작 제어)
// ----------------------------------------------------------------
const mockExistsSync = jest.fn();
const mockUnlinkSync = jest.fn();

jest.mock('fs', () => ({
  existsSync: mockExistsSync,
  unlinkSync: mockUnlinkSync,
}));

// ----------------------------------------------------------------
// 테스트 대상 import
// ----------------------------------------------------------------
import globalTeardown from '../e2e/global-teardown';

// ----------------------------------------------------------------
// 테스트 스위트
// ----------------------------------------------------------------

describe('e2e/global-teardown.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockExistsSync.mockReturnValue(false);
  });

  describe('모듈 export 확인', () => {
    it('globalTeardown 함수를 default export해야 한다', () => {
      expect(typeof globalTeardown).toBe('function');
    });

    it('globalTeardown은 Promise를 반환해야 한다', async () => {
      const result = globalTeardown();
      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });

  describe('DB 파일 정리', () => {
    it('DB 파일이 존재할 때 unlinkSync를 호출해야 한다', async () => {
      mockExistsSync.mockReturnValue(true);
      await globalTeardown();
      expect(mockUnlinkSync).toHaveBeenCalled();
    });

    it('DB 파일이 없을 때 unlinkSync를 호출하지 않아야 한다', async () => {
      mockExistsSync.mockReturnValue(false);
      await globalTeardown();
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });
  });
});
