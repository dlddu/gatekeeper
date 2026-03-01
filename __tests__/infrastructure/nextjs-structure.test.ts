/**
 * Next.js 15 프로젝트 구조 검증 테스트
 *
 * App Router, TypeScript 설정, 필수 파일 존재 여부를 검증합니다.
 */

import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();

describe('Next.js 15 project structure', () => {
  // ----------------------------------------------------------------
  // 필수 설정 파일
  // ----------------------------------------------------------------
  describe('required configuration files', () => {
    it('should have package.json', () => {
      expect(fs.existsSync(path.join(ROOT, 'package.json'))).toBe(true);
    });

    it('should have tsconfig.json', () => {
      expect(fs.existsSync(path.join(ROOT, 'tsconfig.json'))).toBe(true);
    });

    it('should have next.config.ts or next.config.js', () => {
      const hasTs = fs.existsSync(path.join(ROOT, 'next.config.ts'));
      const hasJs = fs.existsSync(path.join(ROOT, 'next.config.js'));
      expect(hasTs || hasJs).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // package.json 내용 검증
  // ----------------------------------------------------------------
  describe('package.json', () => {
    let pkg: Record<string, unknown>;

    beforeAll(() => {
      const content = fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8');
      pkg = JSON.parse(content);
    });

    it('should have next as a dependency', () => {
      const deps = pkg.dependencies as Record<string, string> | undefined;
      expect(deps).toBeDefined();
      expect(deps!['next']).toBeDefined();
    });

    it('should have next version 15 or higher', () => {
      const deps = pkg.dependencies as Record<string, string>;
      const nextVersion = deps['next'];
      // 버전 문자열에서 메이저 버전 추출 (^16.x.x, 15.x.x 등)
      const majorMatch = nextVersion.match(/(\d+)/);
      expect(majorMatch).not.toBeNull();
      expect(parseInt(majorMatch![1])).toBeGreaterThanOrEqual(15);
    });

    it('should have react as a dependency', () => {
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['react']).toBeDefined();
    });

    it('should have typescript as a devDependency', () => {
      const devDeps = pkg.devDependencies as Record<string, string>;
      expect(devDeps['typescript']).toBeDefined();
    });

    it('should have jest as a devDependency', () => {
      const devDeps = pkg.devDependencies as Record<string, string>;
      expect(devDeps['jest']).toBeDefined();
    });

    it('should have ts-jest as a devDependency', () => {
      const devDeps = pkg.devDependencies as Record<string, string>;
      expect(devDeps['ts-jest']).toBeDefined();
    });

    it('should have @types/jest as a devDependency', () => {
      const devDeps = pkg.devDependencies as Record<string, string>;
      expect(devDeps['@types/jest']).toBeDefined();
    });

    it('should have jose as a dependency', () => {
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['jose']).toBeDefined();
    });

    it('should have prisma as a dependency', () => {
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['prisma']).toBeDefined();
    });

    it('should have @prisma/client as a dependency', () => {
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['@prisma/client']).toBeDefined();
    });

    it('should have bcryptjs as a dependency (not bcrypt)', () => {
      const deps = pkg.dependencies as Record<string, string>;
      expect(deps['bcryptjs']).toBeDefined();
      // 네이티브 바이너리 문제를 방지하기 위해 bcrypt 대신 bcryptjs 사용
      expect(deps['bcrypt']).toBeUndefined();
    });

    it('should have test script defined', () => {
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts['test']).toBeDefined();
    });

    it('should have dev script defined', () => {
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts['dev']).toBeDefined();
    });

    it('should have build script defined', () => {
      const scripts = pkg.scripts as Record<string, string>;
      expect(scripts['build']).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  // TypeScript 설정
  // ----------------------------------------------------------------
  describe('tsconfig.json', () => {
    let tsconfig: Record<string, unknown>;

    beforeAll(() => {
      const content = fs.readFileSync(path.join(ROOT, 'tsconfig.json'), 'utf-8');
      tsconfig = JSON.parse(content);
    });

    it('should have compilerOptions', () => {
      expect(tsconfig.compilerOptions).toBeDefined();
    });

    it('should have strict mode enabled', () => {
      const options = tsconfig.compilerOptions as Record<string, unknown>;
      expect(options.strict).toBe(true);
    });

    it('should have path alias @/* configured', () => {
      const options = tsconfig.compilerOptions as Record<string, unknown>;
      const paths = options.paths as Record<string, unknown> | undefined;
      expect(paths).toBeDefined();
      expect(paths!['@/*']).toBeDefined();
    });
  });

  // ----------------------------------------------------------------
  // App Router 구조
  // ----------------------------------------------------------------
  describe('App Router structure', () => {
    it('should have app/ directory', () => {
      expect(fs.existsSync(path.join(ROOT, 'app'))).toBe(true);
      expect(fs.statSync(path.join(ROOT, 'app')).isDirectory()).toBe(true);
    });

    it('should have app/layout.tsx or app/layout.ts', () => {
      const hasTsx = fs.existsSync(path.join(ROOT, 'app', 'layout.tsx'));
      const hasTs = fs.existsSync(path.join(ROOT, 'app', 'layout.ts'));
      expect(hasTsx || hasTs).toBe(true);
    });

    it('should have app/page.tsx or app/page.ts', () => {
      const hasTsx = fs.existsSync(path.join(ROOT, 'app', 'page.tsx'));
      const hasTs = fs.existsSync(path.join(ROOT, 'app', 'page.ts'));
      expect(hasTsx || hasTs).toBe(true);
    });
  });

  // ----------------------------------------------------------------
  // lib/ 디렉토리
  // ----------------------------------------------------------------
  describe('lib/ directory', () => {
    it('should exist', () => {
      expect(fs.existsSync(path.join(ROOT, 'lib'))).toBe(true);
    });

    it('should contain auth.ts', () => {
      expect(fs.existsSync(path.join(ROOT, 'lib', 'auth.ts'))).toBe(true);
    });

    it('should contain prisma.ts', () => {
      expect(fs.existsSync(path.join(ROOT, 'lib', 'prisma.ts'))).toBe(true);
    });
  });
});
