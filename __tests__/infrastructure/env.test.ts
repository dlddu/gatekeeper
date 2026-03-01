/**
 * 환경변수 문서화 테스트
 *
 * .env.example 파일에 필요한 모든 환경변수 키가 정의되어 있는지 검증합니다.
 */

import fs from 'fs';
import path from 'path';

const ENV_EXAMPLE_PATH = path.join(process.cwd(), '.env.example');

describe('.env.example', () => {
  let envContent: string;
  let envKeys: string[];

  beforeAll(() => {
    envContent = fs.readFileSync(ENV_EXAMPLE_PATH, 'utf-8');
    // 주석(#)과 빈 줄을 제외하고 KEY=value 형식의 줄에서 KEY만 추출
    envKeys = envContent
      .split('\n')
      .filter((line) => line.trim() && !line.trim().startsWith('#'))
      .map((line) => line.split('=')[0].trim());
  });

  it('should exist at project root', () => {
    expect(fs.existsSync(ENV_EXAMPLE_PATH)).toBe(true);
  });

  it('should not be empty', () => {
    expect(envContent.trim().length).toBeGreaterThan(0);
  });

  describe('required environment variable keys', () => {
    it('should contain DATABASE_URL', () => {
      expect(envKeys).toContain('DATABASE_URL');
    });

    it('should contain JWT_SECRET', () => {
      expect(envKeys).toContain('JWT_SECRET');
    });

    it('should contain VAPID_PUBLIC_KEY', () => {
      expect(envKeys).toContain('VAPID_PUBLIC_KEY');
    });

    it('should contain VAPID_PRIVATE_KEY', () => {
      expect(envKeys).toContain('VAPID_PRIVATE_KEY');
    });

    it('should contain VAPID_SUBJECT', () => {
      expect(envKeys).toContain('VAPID_SUBJECT');
    });
  });

  describe('key format', () => {
    it('should have values (even if placeholder) for all keys', () => {
      const lines = envContent
        .split('\n')
        .filter((line) => line.trim() && !line.trim().startsWith('#'));

      lines.forEach((line) => {
        // KEY=value 또는 KEY="value" 형식이어야 함
        expect(line).toMatch(/^[A-Z_]+=.+/);
      });
    });

    it('should not have duplicate keys', () => {
      const uniqueKeys = new Set(envKeys);
      expect(uniqueKeys.size).toBe(envKeys.length);
    });
  });
});
