/**
 * Prisma 스키마 파일 검증 테스트
 *
 * prisma/schema.prisma가 올바른 모델 정의를 포함하는지 검증합니다.
 */

import fs from 'fs';
import path from 'path';

const SCHEMA_PATH = path.join(process.cwd(), 'prisma', 'schema.prisma');

describe('prisma/schema.prisma', () => {
  let schemaContent: string;

  beforeAll(() => {
    schemaContent = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  });

  it('should exist', () => {
    expect(fs.existsSync(SCHEMA_PATH)).toBe(true);
  });

  it('should not be empty', () => {
    expect(schemaContent.trim().length).toBeGreaterThan(0);
  });

  describe('generator configuration', () => {
    it('should define prisma-client-js generator', () => {
      expect(schemaContent).toContain('provider = "prisma-client-js"');
    });
  });

  describe('datasource configuration', () => {
    it('should use sqlite provider', () => {
      expect(schemaContent).toContain('provider = "sqlite"');
    });
  });

  // ----------------------------------------------------------------
  // User model
  // ----------------------------------------------------------------
  describe('User model', () => {
    it('should define the User model', () => {
      expect(schemaContent).toMatch(/model User \{/);
    });

    it('should have id field', () => {
      const userModelMatch = schemaContent.match(/model User \{([^}]+)\}/s);
      expect(userModelMatch).not.toBeNull();
      expect(userModelMatch![1]).toContain('id');
    });

    it('should have username field', () => {
      const userModelMatch = schemaContent.match(/model User \{([^}]+)\}/s);
      expect(userModelMatch![1]).toContain('username');
    });

    it('should have passwordHash field', () => {
      const userModelMatch = schemaContent.match(/model User \{([^}]+)\}/s);
      expect(userModelMatch![1]).toContain('passwordHash');
    });

    it('should have displayName field', () => {
      const userModelMatch = schemaContent.match(/model User \{([^}]+)\}/s);
      expect(userModelMatch![1]).toContain('displayName');
    });

    it('should have createdAt field', () => {
      const userModelMatch = schemaContent.match(/model User \{([^}]+)\}/s);
      expect(userModelMatch![1]).toContain('createdAt');
    });

    it('should have updatedAt field', () => {
      const userModelMatch = schemaContent.match(/model User \{([^}]+)\}/s);
      expect(userModelMatch![1]).toContain('updatedAt');
    });

    it('should have unique constraint on username', () => {
      const userModelMatch = schemaContent.match(/model User \{([^}]+)\}/s);
      expect(userModelMatch![1]).toMatch(/username.*@unique|@unique.*username/);
    });

    // ----------------------------------------------------------------
    // OIDC 지원 필드
    // ----------------------------------------------------------------

    it('should have passwordHash field as nullable (String?)', () => {
      // passwordHash는 OIDC 전용 사용자는 비밀번호가 없으므로 nullable이어야 한다
      const userModelMatch = schemaContent.match(/model User \{([^}]+)\}/s);
      expect(userModelMatch).not.toBeNull();
      // "String?" 타입이어야 하며, "String " (non-nullable) 이어서는 안 된다
      expect(userModelMatch![1]).toMatch(/passwordHash\s+String\?/);
    });

    it('should have email field as nullable (String?)', () => {
      // email은 OIDC id_token의 email claim을 저장하는 선택적 필드이다
      const userModelMatch = schemaContent.match(/model User \{([^}]+)\}/s);
      expect(userModelMatch).not.toBeNull();
      expect(userModelMatch![1]).toContain('email');
      expect(userModelMatch![1]).toMatch(/email\s+String\?/);
    });

    it('should have oidcSub field as nullable unique (String? @unique)', () => {
      // oidcSub는 OIDC subject identifier로 auto-provisioning의 키이며 unique해야 한다
      const userModelMatch = schemaContent.match(/model User \{([^}]+)\}/s);
      expect(userModelMatch).not.toBeNull();
      expect(userModelMatch![1]).toContain('oidcSub');
      expect(userModelMatch![1]).toMatch(/oidcSub\s+String\?.*@unique|oidcSub\s+String\?/);
      expect(userModelMatch![1]).toMatch(/oidcSub.*@unique|@unique.*oidcSub/);
    });
  });

  // ----------------------------------------------------------------
  // Request model
  // ----------------------------------------------------------------
  describe('Request model', () => {
    it('should define the Request model', () => {
      expect(schemaContent).toMatch(/model Request \{/);
    });

    it('should have id field', () => {
      const requestModelMatch = schemaContent.match(/model Request \{([^}]+)\}/s);
      expect(requestModelMatch).not.toBeNull();
      expect(requestModelMatch![1]).toContain('id');
    });

    it('should have externalId field', () => {
      const requestModelMatch = schemaContent.match(/model Request \{([^}]+)\}/s);
      expect(requestModelMatch![1]).toContain('externalId');
    });

    it('should have context field', () => {
      const requestModelMatch = schemaContent.match(/model Request \{([^}]+)\}/s);
      expect(requestModelMatch![1]).toContain('context');
    });

    it('should have requesterName field', () => {
      const requestModelMatch = schemaContent.match(/model Request \{([^}]+)\}/s);
      expect(requestModelMatch![1]).toContain('requesterName');
    });

    it('should have status field', () => {
      const requestModelMatch = schemaContent.match(/model Request \{([^}]+)\}/s);
      expect(requestModelMatch![1]).toContain('status');
    });

    it('should have timeoutSeconds field (nullable)', () => {
      const requestModelMatch = schemaContent.match(/model Request \{([^}]+)\}/s);
      expect(requestModelMatch![1]).toContain('timeoutSeconds');
    });

    it('should have createdAt field', () => {
      const requestModelMatch = schemaContent.match(/model Request \{([^}]+)\}/s);
      expect(requestModelMatch![1]).toContain('createdAt');
    });

    it('should have updatedAt field', () => {
      const requestModelMatch = schemaContent.match(/model Request \{([^}]+)\}/s);
      expect(requestModelMatch![1]).toContain('updatedAt');
    });

    it('should have processedAt field', () => {
      const requestModelMatch = schemaContent.match(/model Request \{([^}]+)\}/s);
      expect(requestModelMatch![1]).toContain('processedAt');
    });

    it('should have processedBy relation to User', () => {
      const requestModelMatch = schemaContent.match(/model Request \{([^}]+)\}/s);
      expect(requestModelMatch![1]).toContain('processedBy');
    });

    it('should have unique constraint on externalId', () => {
      const requestModelMatch = schemaContent.match(/model Request \{([^}]+)\}/s);
      expect(requestModelMatch![1]).toMatch(/externalId.*@unique|@unique.*externalId/);
    });
  });

  // ----------------------------------------------------------------
  // PushSubscription model
  // ----------------------------------------------------------------
  describe('PushSubscription model', () => {
    it('should define the PushSubscription model', () => {
      expect(schemaContent).toMatch(/model PushSubscription \{/);
    });

    it('should have id field', () => {
      const modelMatch = schemaContent.match(/model PushSubscription \{([^}]+)\}/s);
      expect(modelMatch).not.toBeNull();
      expect(modelMatch![1]).toContain('id');
    });

    it('should have userId field linking to User', () => {
      const modelMatch = schemaContent.match(/model PushSubscription \{([^}]+)\}/s);
      expect(modelMatch![1]).toContain('userId');
    });

    it('should have endpoint field', () => {
      const modelMatch = schemaContent.match(/model PushSubscription \{([^}]+)\}/s);
      expect(modelMatch![1]).toContain('endpoint');
    });

    it('should have p256dh field', () => {
      const modelMatch = schemaContent.match(/model PushSubscription \{([^}]+)\}/s);
      expect(modelMatch![1]).toContain('p256dh');
    });

    it('should have auth field', () => {
      const modelMatch = schemaContent.match(/model PushSubscription \{([^}]+)\}/s);
      expect(modelMatch![1]).toContain('auth');
    });

    it('should have createdAt field', () => {
      const modelMatch = schemaContent.match(/model PushSubscription \{([^}]+)\}/s);
      expect(modelMatch![1]).toContain('createdAt');
    });

    it('should have unique constraint on endpoint', () => {
      const modelMatch = schemaContent.match(/model PushSubscription \{([^}]+)\}/s);
      expect(modelMatch![1]).toMatch(/endpoint.*@unique|@unique.*endpoint/);
    });
  });

  // ----------------------------------------------------------------
  // RequestStatus enum
  // ----------------------------------------------------------------
  describe('RequestStatus enum', () => {
    it('should define RequestStatus enum', () => {
      expect(schemaContent).toMatch(/enum RequestStatus \{/);
    });

    it('should include PENDING status', () => {
      const enumMatch = schemaContent.match(/enum RequestStatus \{([^}]+)\}/s);
      expect(enumMatch).not.toBeNull();
      expect(enumMatch![1]).toContain('PENDING');
    });

    it('should include APPROVED status', () => {
      const enumMatch = schemaContent.match(/enum RequestStatus \{([^}]+)\}/s);
      expect(enumMatch![1]).toContain('APPROVED');
    });

    it('should include REJECTED status', () => {
      const enumMatch = schemaContent.match(/enum RequestStatus \{([^}]+)\}/s);
      expect(enumMatch![1]).toContain('REJECTED');
    });

    it('should include EXPIRED status', () => {
      const enumMatch = schemaContent.match(/enum RequestStatus \{([^}]+)\}/s);
      expect(enumMatch![1]).toContain('EXPIRED');
    });
  });
});
