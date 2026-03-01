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
      'httproute.yaml',
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

    it('should define resource requests', () => {
      expect(content).toContain('requests:');
    });

    it('should define resource limits', () => {
      expect(content).toContain('limits:');
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
  // HTTPRoute
  // ----------------------------------------------------------------
  describe('httproute.yaml', () => {
    let content: string;

    beforeAll(() => {
      content = readK8sFile('httproute.yaml');
    });

    it('should have kind HTTPRoute', () => {
      expect(content).toContain('kind: HTTPRoute');
    });

    it('should use gateway.networking.k8s.io apiVersion', () => {
      expect(content).toContain('gateway.networking.k8s.io');
    });

    it('should define parentRefs to a gateway', () => {
      expect(content).toContain('parentRefs:');
    });

    it('should define hostnames', () => {
      expect(content).toContain('hostnames:');
    });

    it('should define routing rules', () => {
      expect(content).toContain('rules:');
    });

    it('should reference gatekeeper backend service', () => {
      expect(content).toContain('name: gatekeeper');
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
