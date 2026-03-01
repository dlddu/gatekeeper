/**
 * Dockerfile 구조 검증 테스트
 *
 * Dockerfile이 존재하고 멀티스테이지 빌드(standalone 출력)를 포함하는지 검증합니다.
 */

import fs from 'fs';
import path from 'path';

const DOCKERFILE_PATH = path.join(process.cwd(), 'Dockerfile');

describe('Dockerfile', () => {
  let dockerfileContent: string;

  beforeAll(() => {
    dockerfileContent = fs.readFileSync(DOCKERFILE_PATH, 'utf-8');
  });

  it('should exist at project root', () => {
    expect(fs.existsSync(DOCKERFILE_PATH)).toBe(true);
  });

  it('should not be empty', () => {
    expect(dockerfileContent.trim().length).toBeGreaterThan(0);
  });

  describe('multi-stage build structure', () => {
    it('should have at least 3 FROM stages', () => {
      const fromLines = dockerfileContent
        .split('\n')
        .filter((line) => line.trim().toUpperCase().startsWith('FROM'));
      expect(fromLines.length).toBeGreaterThanOrEqual(3);
    });

    it('should have a deps stage', () => {
      expect(dockerfileContent).toMatch(/FROM .+ AS deps/i);
    });

    it('should have a builder stage', () => {
      expect(dockerfileContent).toMatch(/FROM .+ AS builder/i);
    });

    it('should have a runner stage', () => {
      expect(dockerfileContent).toMatch(/FROM .+ AS runner/i);
    });
  });

  describe('standalone output', () => {
    it('should copy .next/standalone directory', () => {
      expect(dockerfileContent).toContain('.next/standalone');
    });

    it('should copy .next/static directory', () => {
      expect(dockerfileContent).toContain('.next/static');
    });

    it('should run server.js as entrypoint', () => {
      expect(dockerfileContent).toContain('server.js');
    });
  });

  describe('Node.js base image', () => {
    it('should use node base image', () => {
      expect(dockerfileContent).toMatch(/FROM node:/i);
    });

    it('should use alpine variant for smaller image size', () => {
      expect(dockerfileContent).toMatch(/node:\d+-alpine/i);
    });
  });

  describe('security best practices', () => {
    it('should create a non-root user', () => {
      // adduser 또는 useradd 명령어가 있어야 함
      expect(dockerfileContent).toMatch(/adduser|useradd/i);
    });

    it('should switch to non-root user', () => {
      expect(dockerfileContent).toMatch(/^USER /m);
    });
  });

  describe('port configuration', () => {
    it('should expose port 3000', () => {
      expect(dockerfileContent).toContain('EXPOSE 3000');
    });

    it('should set PORT environment variable', () => {
      expect(dockerfileContent).toContain('PORT');
    });
  });

  describe('Prisma setup', () => {
    it('should run prisma generate during build', () => {
      expect(dockerfileContent).toContain('prisma generate');
    });
  });

  describe('production settings', () => {
    it('should set NODE_ENV to production in runner stage', () => {
      expect(dockerfileContent).toContain('NODE_ENV=production');
    });

    it('should disable Next.js telemetry', () => {
      expect(dockerfileContent).toContain('NEXT_TELEMETRY_DISABLED');
    });
  });
});
