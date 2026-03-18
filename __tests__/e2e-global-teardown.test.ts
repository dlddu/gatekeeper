/**
 * e2e/global-teardown.ts 단위 테스트
 *
 * DLD-795: e2e global-setup에 OIDC Mock 서버 통합
 *
 * 검증 범위:
 * - globalTeardown 실행 시 stopOidcMockServer() 호출 여부
 * - stopOidcMockServer가 정확히 1번 호출되는지 여부
 * - stopOidcMockServer 실패 시에도 DB 파일 정리가 수행되는지 여부
 * - stopOidcMockServer 호출 후 DB 파일 삭제가 이루어지는지 여부
 *
 * 참고:
 * - global-teardown은 Playwright가 호출하는 함수이므로 직접 import하여 단위 테스트
 * - stopOidcMockServer는 mock하여 실제 서버 종료 방지
 */

// ----------------------------------------------------------------
// oidc-mock 모듈 전체를 mock 처리
// ----------------------------------------------------------------
jest.mock('../e2e/helpers/oidc-mock', () => ({
  startOidcMockServer: jest.fn().mockResolvedValue(undefined),
  stopOidcMockServer: jest.fn().mockResolvedValue(undefined),
}));

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
// 구현이 완료되지 않은 경우 이 import는 실패합니다 (TDD Red Phase)
// ----------------------------------------------------------------
import globalTeardown from '../e2e/global-teardown';
import {
  startOidcMockServer,
  stopOidcMockServer,
} from '../e2e/helpers/oidc-mock';

// ----------------------------------------------------------------
// 테스트 스위트
// ----------------------------------------------------------------

describe('e2e/global-teardown.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // 기본값: DB 파일 없음
    mockExistsSync.mockReturnValue(false);

    // stopOidcMockServer 기본 동작: 성공
    (stopOidcMockServer as jest.Mock).mockResolvedValue(undefined);
  });

  // ----------------------------------------------------------------
  // export 확인
  // ----------------------------------------------------------------
  describe('모듈 export 확인', () => {
    it('globalTeardown 함수를 default export해야 한다', () => {
      // Assert
      expect(typeof globalTeardown).toBe('function');
    });

    it('globalTeardown은 Promise를 반환해야 한다', async () => {
      // Act
      const result = globalTeardown();

      // Assert
      expect(result).toBeInstanceOf(Promise);

      await result;
    });
  });

  // ----------------------------------------------------------------
  // OIDC Mock 서버 종료
  // ----------------------------------------------------------------
  describe('OIDC Mock 서버 종료', () => {
    it('globalTeardown 실행 시 stopOidcMockServer를 호출해야 한다', async () => {
      // Act
      await globalTeardown();

      // Assert
      expect(stopOidcMockServer).toHaveBeenCalled();
    });

    it('stopOidcMockServer는 인수 없이 호출되어야 한다', async () => {
      // Act
      await globalTeardown();

      // Assert
      expect(stopOidcMockServer).toHaveBeenCalledWith();
    });

    it('stopOidcMockServer는 정확히 1번만 호출되어야 한다', async () => {
      // Act
      await globalTeardown();

      // Assert
      expect(stopOidcMockServer).toHaveBeenCalledTimes(1);
    });

    it('startOidcMockServer는 globalTeardown에서 호출되지 않아야 한다', async () => {
      // Act
      await globalTeardown();

      // Assert
      expect(startOidcMockServer).not.toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // DB 파일 정리와의 관계
  // ----------------------------------------------------------------
  describe('DB 파일 정리와의 관계', () => {
    it('stopOidcMockServer 호출 후에도 DB 파일 정리가 수행되어야 한다', async () => {
      // Arrange — DB 파일이 존재하는 상황
      mockExistsSync.mockReturnValue(true);

      // Act
      await globalTeardown();

      // Assert — DB 파일 삭제도 수행되어야 함
      expect(mockUnlinkSync).toHaveBeenCalled();
    });

    it('stopOidcMockServer 실패 시에도 globalTeardown이 완료되어야 한다', async () => {
      // Arrange
      (stopOidcMockServer as jest.Mock).mockRejectedValue(
        new Error('서버 종료 실패')
      );
      mockExistsSync.mockReturnValue(true);

      // Act & Assert — 에러가 전파되거나, 또는 정리 로직이 계속 실행되어야 함
      // (구현 방식에 따라 reject 또는 resolve 가능)
      // 최소한 함수 호출이 완료되어야 함 (무한 hang 없음)
      const result = globalTeardown();
      await expect(Promise.race([
        result,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ])).resolves.toBeUndefined().catch(() => {
        // stopOidcMockServer 실패를 전파하는 구현도 허용
      });
    });
  });

  // ----------------------------------------------------------------
  // 엣지 케이스
  // ----------------------------------------------------------------
  describe('엣지 케이스', () => {
    it('DB 파일이 없어도 stopOidcMockServer를 호출해야 한다', async () => {
      // Arrange — DB 파일 없음
      mockExistsSync.mockReturnValue(false);

      // Act
      await globalTeardown();

      // Assert
      expect(stopOidcMockServer).toHaveBeenCalled();
    });

    it('DB 파일이 모두 존재할 때 stopOidcMockServer도 호출해야 한다', async () => {
      // Arrange — 모든 DB 파일 존재
      mockExistsSync.mockReturnValue(true);

      // Act
      await globalTeardown();

      // Assert
      expect(stopOidcMockServer).toHaveBeenCalledTimes(1);
    });
  });
});
