/**
 * Kubernetes 매니페스트 파일 검증 테스트
 *
 * k8s/ 디렉토리에 필요한 YAML 파일이 존재하고 올바른 구조를 가지는지 검증합니다.
 */

import fs from 'fs';
import path from 'path';

const K8S_DIR = path.join(process.cwd(), 'k8s');

/**
 * YAML 파일을 읽어 간단한 키-값 파싱을 수행합니다.
 * 완전한 YAML 파서 대신 패턴 매칭으로 주요 필드를 확인합니다.
 */
function readK8sFile(filename: string): string {
  return fs.readFileSync(path.join(K8S_DIR, filename), 'utf-8');
}

describe('k8s/ directory', () => {
  it('should exist', () => {
    expect(fs.existsSync(K8S_DIR)).toBe(true);
    expect(fs.statSync(K8S_DIR).isDirectory()).toBe(true);
  });

  describe('required manifest files', () => {
    const requiredFiles = [
      'deployment.yaml',
      'service.yaml',
      'pvc.yaml',
    ];

    requiredFiles.forEach((filename) => {
      it(`should contain ${filename}`, () => {
        const filePath = path.join(K8S_DIR, filename);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    requiredFiles.forEach((filename) => {
      it(`${filename} should not be empty`, () => {
        const content = readK8sFile(filename);
        expect(content.trim().length).toBeGreaterThan(0);
      });
    });
  });

  // ----------------------------------------------------------------
  // Deployment
  // ----------------------------------------------------------------
  describe('deployment.yaml', () => {
    let content: string;

    beforeAll(() => {
      content = readK8sFile('deployment.yaml');
    });

    it('should have apiVersion apps/v1', () => {
      expect(content).toContain('apiVersion: apps/v1');
    });

    it('should have kind Deployment', () => {
      expect(content).toContain('kind: Deployment');
    });

    it('should have gatekeeper as the app name', () => {
      expect(content).toContain('app: gatekeeper');
    });

    it('should define container port 3000', () => {
      expect(content).toContain('containerPort: 3000');
    });

    it('should reference DATABASE_URL secret', () => {
      expect(content).toContain('DATABASE_URL');
    });

    it('should reference JWT_SECRET secret', () => {
      expect(content).toContain('JWT_SECRET');
    });

    it('should reference VAPID_PUBLIC_KEY secret', () => {
      expect(content).toContain('VAPID_PUBLIC_KEY');
    });

    it('should reference VAPID_PRIVATE_KEY secret', () => {
      expect(content).toContain('VAPID_PRIVATE_KEY');
    });

    it('should mount a PersistentVolumeClaim', () => {
      expect(content).toContain('persistentVolumeClaim');
    });

    describe('OIDC environment variables via secretKeyRef', () => {
      it('should reference OIDC_ISSUER secret', () => {
        expect(content).toContain('OIDC_ISSUER');
      });

      it('should reference OIDC_CLIENT_ID secret', () => {
        expect(content).toContain('OIDC_CLIENT_ID');
      });

      it('should reference OIDC_CLIENT_SECRET secret', () => {
        expect(content).toContain('OIDC_CLIENT_SECRET');
      });

      it('should reference OIDC_REDIRECT_URI secret', () => {
        expect(content).toContain('OIDC_REDIRECT_URI');
      });

      it('should inject OIDC_ISSUER via secretKeyRef from gatekeeper-secrets', () => {
        // name: OIDC_ISSUER 바로 다음에 secretKeyRef 블록이 와야 함
        expect(content).toMatch(
          /name:\s+OIDC_ISSUER[\s\S]*?secretKeyRef:\s*\n\s*name:\s+gatekeeper-secrets[\s\S]*?key:\s+OIDC_ISSUER/
        );
      });

      it('should inject OIDC_CLIENT_ID via secretKeyRef from gatekeeper-secrets', () => {
        expect(content).toMatch(
          /name:\s+OIDC_CLIENT_ID[\s\S]*?secretKeyRef:\s*\n\s*name:\s+gatekeeper-secrets[\s\S]*?key:\s+OIDC_CLIENT_ID/
        );
      });

      it('should inject OIDC_CLIENT_SECRET via secretKeyRef from gatekeeper-secrets', () => {
        expect(content).toMatch(
          /name:\s+OIDC_CLIENT_SECRET[\s\S]*?secretKeyRef:\s*\n\s*name:\s+gatekeeper-secrets[\s\S]*?key:\s+OIDC_CLIENT_SECRET/
        );
      });

      it('should inject OIDC_REDIRECT_URI via secretKeyRef from gatekeeper-secrets', () => {
        expect(content).toMatch(
          /name:\s+OIDC_REDIRECT_URI[\s\S]*?secretKeyRef:\s*\n\s*name:\s+gatekeeper-secrets[\s\S]*?key:\s+OIDC_REDIRECT_URI/
        );
      });
    });

  });

  // ----------------------------------------------------------------
  // Service
  // ----------------------------------------------------------------
  describe('service.yaml', () => {
    let content: string;

    beforeAll(() => {
      content = readK8sFile('service.yaml');
    });

    it('should have apiVersion v1', () => {
      expect(content).toContain('apiVersion: v1');
    });

    it('should have kind Service', () => {
      expect(content).toContain('kind: Service');
    });

    it('should select app: gatekeeper', () => {
      expect(content).toContain('app: gatekeeper');
    });

    it('should expose port 80', () => {
      expect(content).toContain('port: 80');
    });

    it('should target port 3000', () => {
      expect(content).toContain('targetPort: 3000');
    });

    it('should be ClusterIP type', () => {
      expect(content).toContain('ClusterIP');
    });
  });

  // ----------------------------------------------------------------
  // PVC
  // ----------------------------------------------------------------
  describe('pvc.yaml', () => {
    let content: string;

    beforeAll(() => {
      content = readK8sFile('pvc.yaml');
    });

    it('should have apiVersion v1', () => {
      expect(content).toContain('apiVersion: v1');
    });

    it('should have kind PersistentVolumeClaim', () => {
      expect(content).toContain('kind: PersistentVolumeClaim');
    });

    it('should have ReadWriteOnce access mode', () => {
      expect(content).toContain('ReadWriteOnce');
    });

    it('should request storage', () => {
      expect(content).toContain('storage:');
    });

    it('should be labeled for gatekeeper app', () => {
      expect(content).toContain('app: gatekeeper');
    });
  });
});

// ----------------------------------------------------------------
// playwright.config.ts - webServer.env 검증
// DLD-828: OIDC 환경변수 제거됨. Forward Auth 방식 검증은
// __tests__/infrastructure/playwright-config.test.ts 에서 담당.
// ----------------------------------------------------------------
describe('playwright.config.ts', () => {
  const PLAYWRIGHT_CONFIG_PATH = path.join(process.cwd(), 'playwright.config.ts');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(PLAYWRIGHT_CONFIG_PATH, 'utf-8');
  });

  it('should exist at project root', () => {
    expect(fs.existsSync(PLAYWRIGHT_CONFIG_PATH)).toBe(true);
  });

  describe('webServer.env Forward Auth 설정', () => {
    it('should NOT define OIDC_ISSUER in webServer.env (removed in Forward Auth migration)', () => {
      expect(content).not.toContain('OIDC_ISSUER');
    });

    it('should NOT define OIDC_CLIENT_ID in webServer.env (removed in Forward Auth migration)', () => {
      expect(content).not.toContain('OIDC_CLIENT_ID');
    });

    it('should NOT define OIDC_CLIENT_SECRET in webServer.env (removed in Forward Auth migration)', () => {
      expect(content).not.toContain('OIDC_CLIENT_SECRET');
    });

    it('should NOT define OIDC_REDIRECT_URI in webServer.env (removed in Forward Auth migration)', () => {
      expect(content).not.toContain('OIDC_REDIRECT_URI');
    });

  });
});
