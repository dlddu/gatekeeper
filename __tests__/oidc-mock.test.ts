/**
 * OIDC Mock 서버 단위/통합 테스트
 *
 * e2e/helpers/oidc-mock.ts의 동작을 검증합니다.
 *
 * 검증 범위:
 * - startOidcMockServer / stopOidcMockServer export 확인
 * - GET /.well-known/openid-configuration — discovery document
 * - GET /authorize — Authorization Code Flow 리다이렉트
 * - POST /token — code 교환 → id_token + access_token 반환
 * - GET /jwks — JWK Set 공개키 반환
 * - id_token이 /jwks 공개키로 검증 가능한지 (RS256)
 * - Authorization Code Flow 전체 흐름
 */

import http from 'http';
import { jwtVerify, importJWK } from 'jose';

// ----------------------------------------------------------------
// 테스트 대상 import
// 구현 파일이 아직 없으므로 이 import는 실패합니다 (TDD Red Phase)
// ----------------------------------------------------------------
import {
  startOidcMockServer,
  stopOidcMockServer,
} from '../e2e/helpers/oidc-mock';

// ----------------------------------------------------------------
// 상수
// ----------------------------------------------------------------
const MOCK_PORT = 19999; // 테스트 전용 포트 (playwright 9999와 충돌 방지)
const ISSUER = `http://localhost:${MOCK_PORT}`;
const CLIENT_ID = 'test-client';

// ----------------------------------------------------------------
// 헬퍼 유틸리티
// ----------------------------------------------------------------

/**
 * http.request를 Promise로 래핑합니다.
 */
function httpRequest(options: http.RequestOptions, body?: string): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: res.headers,
          body: data,
        });
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
}

/**
 * GET 요청 헬퍼
 */
function httpGet(path: string): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: string }> {
  return httpRequest({
    hostname: 'localhost',
    port: MOCK_PORT,
    path,
    method: 'GET',
  });
}

/**
 * POST 요청 헬퍼 (application/x-www-form-urlencoded)
 */
function httpPost(path: string, formData: Record<string, string>): Promise<{
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}> {
  const encoded = new URLSearchParams(formData).toString();
  return httpRequest(
    {
      hostname: 'localhost',
      port: MOCK_PORT,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(encoded),
      },
    },
    encoded
  );
}

// ----------------------------------------------------------------
// 테스트 스위트
// ----------------------------------------------------------------

describe('OIDC Mock Server (e2e/helpers/oidc-mock.ts)', () => {
  // ----------------------------------------------------------------
  // export 존재 확인
  // ----------------------------------------------------------------
  describe('모듈 export 확인', () => {
    it('startOidcMockServer 함수를 export해야 한다', () => {
      // Assert
      expect(typeof startOidcMockServer).toBe('function');
    });

    it('stopOidcMockServer 함수를 export해야 한다', () => {
      // Assert
      expect(typeof stopOidcMockServer).toBe('function');
    });

    it('startOidcMockServer는 Promise를 반환해야 한다', () => {
      // Act
      const result = startOidcMockServer(MOCK_PORT);

      // Assert
      expect(result).toBeInstanceOf(Promise);

      // 테스트 이후 서버를 정리합니다
      return result.then(() => stopOidcMockServer());
    });
  });

  // ----------------------------------------------------------------
  // 서버 생명주기
  // ----------------------------------------------------------------
  describe('서버 시작/종료', () => {
    it('startOidcMockServer는 지정된 포트에서 서버를 시작해야 한다', async () => {
      // Arrange & Act
      await startOidcMockServer(MOCK_PORT);

      // Assert — 포트에 연결 가능한지 확인
      const res = await httpGet('/.well-known/openid-configuration');
      expect(res.statusCode).toBe(200);

      // Teardown
      await stopOidcMockServer();
    });

    it('stopOidcMockServer 호출 후 서버가 종료되어야 한다', async () => {
      // Arrange
      await startOidcMockServer(MOCK_PORT);

      // Act
      await stopOidcMockServer();

      // Assert — 서버가 종료되면 연결 거부가 발생해야 함
      await expect(httpGet('/.well-known/openid-configuration')).rejects.toThrow();
    });

    it('stopOidcMockServer는 Promise를 반환해야 한다', async () => {
      // Arrange
      await startOidcMockServer(MOCK_PORT);

      // Act
      const result = stopOidcMockServer();

      // Assert
      expect(result).toBeInstanceOf(Promise);
      await result;
    });
  });

  // ----------------------------------------------------------------
  // 각 엔드포인트 테스트 (서버를 beforeAll/afterAll로 관리)
  // ----------------------------------------------------------------
  describe('OIDC 엔드포인트', () => {
    beforeAll(async () => {
      await startOidcMockServer(MOCK_PORT);
    });

    afterAll(async () => {
      await stopOidcMockServer();
    });

    // ------------------------------------------------------------
    // GET /.well-known/openid-configuration
    // ------------------------------------------------------------
    describe('GET /.well-known/openid-configuration', () => {
      it('200 상태 코드를 반환해야 한다', async () => {
        // Act
        const res = await httpGet('/.well-known/openid-configuration');

        // Assert
        expect(res.statusCode).toBe(200);
      });

      it('Content-Type이 application/json이어야 한다', async () => {
        // Act
        const res = await httpGet('/.well-known/openid-configuration');

        // Assert
        expect(res.headers['content-type']).toMatch(/application\/json/);
      });

      it('issuer 필드를 포함해야 한다', async () => {
        // Act
        const res = await httpGet('/.well-known/openid-configuration');
        const body = JSON.parse(res.body);

        // Assert
        expect(body).toHaveProperty('issuer');
        expect(body.issuer).toBe(ISSUER);
      });

      it('authorization_endpoint 필드를 포함해야 한다', async () => {
        // Act
        const res = await httpGet('/.well-known/openid-configuration');
        const body = JSON.parse(res.body);

        // Assert
        expect(body).toHaveProperty('authorization_endpoint');
        expect(body.authorization_endpoint).toContain('/authorize');
      });

      it('token_endpoint 필드를 포함해야 한다', async () => {
        // Act
        const res = await httpGet('/.well-known/openid-configuration');
        const body = JSON.parse(res.body);

        // Assert
        expect(body).toHaveProperty('token_endpoint');
        expect(body.token_endpoint).toContain('/token');
      });

      it('jwks_uri 필드를 포함해야 한다', async () => {
        // Act
        const res = await httpGet('/.well-known/openid-configuration');
        const body = JSON.parse(res.body);

        // Assert
        expect(body).toHaveProperty('jwks_uri');
        expect(body.jwks_uri).toContain('/jwks');
      });

      it('response_types_supported 필드를 포함해야 한다', async () => {
        // Act
        const res = await httpGet('/.well-known/openid-configuration');
        const body = JSON.parse(res.body);

        // Assert
        expect(body).toHaveProperty('response_types_supported');
        expect(Array.isArray(body.response_types_supported)).toBe(true);
      });

      it('subject_types_supported 필드를 포함해야 한다', async () => {
        // Act
        const res = await httpGet('/.well-known/openid-configuration');
        const body = JSON.parse(res.body);

        // Assert
        expect(body).toHaveProperty('subject_types_supported');
        expect(Array.isArray(body.subject_types_supported)).toBe(true);
      });

      it('id_token_signing_alg_values_supported 필드를 포함하고 RS256을 지원해야 한다', async () => {
        // Act
        const res = await httpGet('/.well-known/openid-configuration');
        const body = JSON.parse(res.body);

        // Assert
        expect(body).toHaveProperty('id_token_signing_alg_values_supported');
        expect(body.id_token_signing_alg_values_supported).toContain('RS256');
      });

      it('모든 URL 필드가 올바른 issuer를 기반으로 해야 한다', async () => {
        // Act
        const res = await httpGet('/.well-known/openid-configuration');
        const body = JSON.parse(res.body);

        // Assert
        expect(body.authorization_endpoint.startsWith(ISSUER)).toBe(true);
        expect(body.token_endpoint.startsWith(ISSUER)).toBe(true);
        expect(body.jwks_uri.startsWith(ISSUER)).toBe(true);
      });
    });

    // ------------------------------------------------------------
    // GET /authorize
    // ------------------------------------------------------------
    describe('GET /authorize', () => {
      it('302 리다이렉트를 반환해야 한다', async () => {
        // Arrange
        const redirectUri = 'http://localhost:3000/api/auth/oidc/callback';
        const state = 'test-state-abc';
        const params = new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: 'code',
          state,
          scope: 'openid email',
        });

        // Act
        const res = await httpGet(`/authorize?${params.toString()}`);

        // Assert
        expect(res.statusCode).toBe(302);
      });

      it('Location 헤더가 redirect_uri를 기반으로 해야 한다', async () => {
        // Arrange
        const redirectUri = 'http://localhost:3000/api/auth/oidc/callback';
        const state = 'test-state-xyz';
        const params = new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: 'code',
          state,
          scope: 'openid email',
        });

        // Act
        const res = await httpGet(`/authorize?${params.toString()}`);

        // Assert
        expect(res.headers['location']).toBeDefined();
        expect(res.headers['location']).toContain(redirectUri);
      });

      it('Location 헤더에 state 파라미터가 포함되어야 한다', async () => {
        // Arrange
        const redirectUri = 'http://localhost:3000/api/auth/oidc/callback';
        const state = 'my-unique-state-123';
        const params = new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: 'code',
          state,
          scope: 'openid email',
        });

        // Act
        const res = await httpGet(`/authorize?${params.toString()}`);

        // Assert
        const location = res.headers['location'] as string;
        const locationUrl = new URL(location);
        expect(locationUrl.searchParams.get('state')).toBe(state);
      });

      it('Location 헤더에 code 파라미터가 포함되어야 한다', async () => {
        // Arrange
        const redirectUri = 'http://localhost:3000/api/auth/oidc/callback';
        const state = 'test-state-code-check';
        const params = new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: 'code',
          state,
          scope: 'openid email',
        });

        // Act
        const res = await httpGet(`/authorize?${params.toString()}`);

        // Assert
        const location = res.headers['location'] as string;
        const locationUrl = new URL(location);
        expect(locationUrl.searchParams.get('code')).toBeTruthy();
        expect((locationUrl.searchParams.get('code') as string).length).toBeGreaterThan(0);
      });

      it('서로 다른 요청에서 서로 다른 code를 생성해야 한다', async () => {
        // Arrange
        const redirectUri = 'http://localhost:3000/api/auth/oidc/callback';
        const makeParams = (state: string) =>
          new URLSearchParams({
            client_id: CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            state,
            scope: 'openid email',
          });

        // Act
        const res1 = await httpGet(`/authorize?${makeParams('state-1').toString()}`);
        const res2 = await httpGet(`/authorize?${makeParams('state-2').toString()}`);

        const code1 = new URL(res1.headers['location'] as string).searchParams.get('code');
        const code2 = new URL(res2.headers['location'] as string).searchParams.get('code');

        // Assert
        expect(code1).not.toBe(code2);
      });
    });

    // ------------------------------------------------------------
    // POST /token
    // ------------------------------------------------------------
    describe('POST /token', () => {
      let validCode: string;
      const redirectUri = 'http://localhost:3000/api/auth/oidc/callback';

      beforeEach(async () => {
        // /authorize에서 신규 code를 획득합니다
        const params = new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: 'code',
          state: 'pre-token-state',
          scope: 'openid email',
        });
        const authRes = await httpGet(`/authorize?${params.toString()}`);
        const location = authRes.headers['location'] as string;
        validCode = new URL(location).searchParams.get('code') as string;
      });

      it('200 상태 코드를 반환해야 한다', async () => {
        // Act
        const res = await httpPost('/token', {
          grant_type: 'authorization_code',
          code: validCode,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });

        // Assert
        expect(res.statusCode).toBe(200);
      });

      it('Content-Type이 application/json이어야 한다', async () => {
        // Act
        const res = await httpPost('/token', {
          grant_type: 'authorization_code',
          code: validCode,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });

        // Assert
        expect(res.headers['content-type']).toMatch(/application\/json/);
      });

      it('id_token 필드를 반환해야 한다', async () => {
        // Act
        const res = await httpPost('/token', {
          grant_type: 'authorization_code',
          code: validCode,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });
        const body = JSON.parse(res.body);

        // Assert
        expect(body).toHaveProperty('id_token');
        expect(typeof body.id_token).toBe('string');
        expect(body.id_token.length).toBeGreaterThan(0);
      });

      it('access_token 필드를 반환해야 한다', async () => {
        // Act
        const res = await httpPost('/token', {
          grant_type: 'authorization_code',
          code: validCode,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });
        const body = JSON.parse(res.body);

        // Assert
        expect(body).toHaveProperty('access_token');
        expect(typeof body.access_token).toBe('string');
        expect(body.access_token.length).toBeGreaterThan(0);
      });

      it('token_type 필드가 Bearer여야 한다', async () => {
        // Act
        const res = await httpPost('/token', {
          grant_type: 'authorization_code',
          code: validCode,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });
        const body = JSON.parse(res.body);

        // Assert
        expect(body).toHaveProperty('token_type');
        expect(body.token_type.toLowerCase()).toBe('bearer');
      });

      it('id_token이 유효한 JWT 형식(3개 파트)이어야 한다', async () => {
        // Act
        const res = await httpPost('/token', {
          grant_type: 'authorization_code',
          code: validCode,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });
        const body = JSON.parse(res.body);

        // Assert — JWT는 header.payload.signature 형식
        const parts = body.id_token.split('.');
        expect(parts).toHaveLength(3);
      });

      it('id_token 헤더에 alg: RS256이 포함되어야 한다', async () => {
        // Act
        const res = await httpPost('/token', {
          grant_type: 'authorization_code',
          code: validCode,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });
        const body = JSON.parse(res.body);

        // Assert — JWT header를 base64url decode
        const headerBase64 = body.id_token.split('.')[0];
        const headerJson = Buffer.from(headerBase64, 'base64url').toString('utf-8');
        const header = JSON.parse(headerJson);
        expect(header.alg).toBe('RS256');
      });

      it('id_token payload에 sub 클레임이 포함되어야 한다', async () => {
        // Act
        const res = await httpPost('/token', {
          grant_type: 'authorization_code',
          code: validCode,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });
        const body = JSON.parse(res.body);

        // Assert — JWT payload를 base64url decode
        const payloadBase64 = body.id_token.split('.')[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        expect(payload).toHaveProperty('sub');
        expect(typeof payload.sub).toBe('string');
        expect(payload.sub.length).toBeGreaterThan(0);
      });

      it('id_token payload에 email 클레임이 포함되어야 한다', async () => {
        // Act
        const res = await httpPost('/token', {
          grant_type: 'authorization_code',
          code: validCode,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });
        const body = JSON.parse(res.body);

        // Assert
        const payloadBase64 = body.id_token.split('.')[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        expect(payload).toHaveProperty('email');
        expect(typeof payload.email).toBe('string');
        expect(payload.email).toContain('@');
      });

      it('id_token payload에 iss 클레임이 issuer와 일치해야 한다', async () => {
        // Act
        const res = await httpPost('/token', {
          grant_type: 'authorization_code',
          code: validCode,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });
        const body = JSON.parse(res.body);

        // Assert
        const payloadBase64 = body.id_token.split('.')[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        expect(payload.iss).toBe(ISSUER);
      });

      it('id_token payload에 aud 클레임이 client_id와 일치해야 한다', async () => {
        // Act
        const res = await httpPost('/token', {
          grant_type: 'authorization_code',
          code: validCode,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });
        const body = JSON.parse(res.body);

        // Assert
        const payloadBase64 = body.id_token.split('.')[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        // aud는 문자열 또는 배열일 수 있음
        const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
        expect(aud).toContain(CLIENT_ID);
      });

      it('id_token payload에 iat 클레임이 포함되어야 한다', async () => {
        // Act
        const res = await httpPost('/token', {
          grant_type: 'authorization_code',
          code: validCode,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });
        const body = JSON.parse(res.body);

        // Assert
        const payloadBase64 = body.id_token.split('.')[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        expect(payload).toHaveProperty('iat');
        expect(typeof payload.iat).toBe('number');
      });

      it('id_token payload에 exp 클레임이 포함되어야 한다', async () => {
        // Act
        const res = await httpPost('/token', {
          grant_type: 'authorization_code',
          code: validCode,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });
        const body = JSON.parse(res.body);

        // Assert
        const payloadBase64 = body.id_token.split('.')[1];
        const payloadJson = Buffer.from(payloadBase64, 'base64url').toString('utf-8');
        const payload = JSON.parse(payloadJson);
        expect(payload).toHaveProperty('exp');
        expect(typeof payload.exp).toBe('number');
        // exp는 iat보다 커야 함
        expect(payload.exp).toBeGreaterThan(payload.iat);
      });

      it('잘못된 code로 요청 시 400 또는 401을 반환해야 한다', async () => {
        // Act
        const res = await httpPost('/token', {
          grant_type: 'authorization_code',
          code: 'invalid-code-that-does-not-exist',
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });

        // Assert
        expect([400, 401]).toContain(res.statusCode);
      });

      it('동일한 code를 두 번 사용하면 두 번째 요청은 실패해야 한다', async () => {
        // Arrange — 첫 번째 요청으로 code 소진
        await httpPost('/token', {
          grant_type: 'authorization_code',
          code: validCode,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });

        // Act — 두 번째 요청
        const secondRes = await httpPost('/token', {
          grant_type: 'authorization_code',
          code: validCode,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });

        // Assert — 재사용 불가
        expect([400, 401]).toContain(secondRes.statusCode);
      });
    });

    // ------------------------------------------------------------
    // GET /jwks
    // ------------------------------------------------------------
    describe('GET /jwks', () => {
      it('200 상태 코드를 반환해야 한다', async () => {
        // Act
        const res = await httpGet('/jwks');

        // Assert
        expect(res.statusCode).toBe(200);
      });

      it('Content-Type이 application/json이어야 한다', async () => {
        // Act
        const res = await httpGet('/jwks');

        // Assert
        expect(res.headers['content-type']).toMatch(/application\/json/);
      });

      it('keys 배열을 포함해야 한다', async () => {
        // Act
        const res = await httpGet('/jwks');
        const body = JSON.parse(res.body);

        // Assert
        expect(body).toHaveProperty('keys');
        expect(Array.isArray(body.keys)).toBe(true);
        expect(body.keys.length).toBeGreaterThanOrEqual(1);
      });

      it('공개키는 kty: RSA 타입이어야 한다', async () => {
        // Act
        const res = await httpGet('/jwks');
        const body = JSON.parse(res.body);

        // Assert
        const key = body.keys[0];
        expect(key).toHaveProperty('kty');
        expect(key.kty).toBe('RSA');
      });

      it('공개키에 use: sig 필드가 포함되어야 한다', async () => {
        // Act
        const res = await httpGet('/jwks');
        const body = JSON.parse(res.body);

        // Assert
        const key = body.keys[0];
        expect(key).toHaveProperty('use');
        expect(key.use).toBe('sig');
      });

      it('공개키에 alg: RS256 필드가 포함되어야 한다', async () => {
        // Act
        const res = await httpGet('/jwks');
        const body = JSON.parse(res.body);

        // Assert
        const key = body.keys[0];
        expect(key).toHaveProperty('alg');
        expect(key.alg).toBe('RS256');
      });

      it('공개키에 RSA 모듈러스(n)와 지수(e)가 포함되어야 한다', async () => {
        // Act
        const res = await httpGet('/jwks');
        const body = JSON.parse(res.body);

        // Assert
        const key = body.keys[0];
        expect(key).toHaveProperty('n');
        expect(key).toHaveProperty('e');
        expect(typeof key.n).toBe('string');
        expect(typeof key.e).toBe('string');
        expect(key.n.length).toBeGreaterThan(0);
      });

      it('공개키에 개인키 정보(d)가 포함되지 않아야 한다', async () => {
        // Act
        const res = await httpGet('/jwks');
        const body = JSON.parse(res.body);

        // Assert — 공개키만 노출해야 함
        const key = body.keys[0];
        expect(key).not.toHaveProperty('d');
      });

      it('공개키는 jose의 importJWK로 import 가능해야 한다', async () => {
        // Act
        const res = await httpGet('/jwks');
        const body = JSON.parse(res.body);
        const jwk = body.keys[0];

        // Assert — importJWK가 오류 없이 실행되어야 함
        await expect(importJWK(jwk, 'RS256')).resolves.toBeDefined();
      });
    });

    // ------------------------------------------------------------
    // RS256 서명 검증
    // ------------------------------------------------------------
    describe('id_token 서명 검증 (/jwks 공개키로)', () => {
      it('/jwks의 공개키로 id_token 서명을 검증할 수 있어야 한다', async () => {
        // Arrange — /authorize로 code 획득
        const redirectUri = 'http://localhost:3000/api/auth/oidc/callback';
        const authParams = new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: 'code',
          state: 'verify-state',
          scope: 'openid email',
        });
        const authRes = await httpGet(`/authorize?${authParams.toString()}`);
        const code = new URL(authRes.headers['location'] as string).searchParams.get('code') as string;

        // /token으로 id_token 획득
        const tokenRes = await httpPost('/token', {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });
        const tokenBody = JSON.parse(tokenRes.body);
        const idToken = tokenBody.id_token;

        // /jwks에서 공개키 획득
        const jwksRes = await httpGet('/jwks');
        const jwksBody = JSON.parse(jwksRes.body);
        const jwk = jwksBody.keys[0];
        const publicKey = await importJWK(jwk, 'RS256');

        // Act — jose jwtVerify로 서명 검증
        const { payload } = await jwtVerify(idToken, publicKey, {
          issuer: ISSUER,
          audience: CLIENT_ID,
        });

        // Assert
        expect(payload).toBeDefined();
        expect(payload.iss).toBe(ISSUER);
      });

      it('서명 검증 후 payload에 sub 클레임이 있어야 한다', async () => {
        // Arrange
        const redirectUri = 'http://localhost:3000/api/auth/oidc/callback';
        const authParams = new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: 'code',
          state: 'sub-verify-state',
          scope: 'openid email',
        });
        const authRes = await httpGet(`/authorize?${authParams.toString()}`);
        const code = new URL(authRes.headers['location'] as string).searchParams.get('code') as string;

        const tokenRes = await httpPost('/token', {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });
        const { id_token } = JSON.parse(tokenRes.body);

        const jwksRes = await httpGet('/jwks');
        const jwk = JSON.parse(jwksRes.body).keys[0];
        const publicKey = await importJWK(jwk, 'RS256');

        // Act
        const { payload } = await jwtVerify(id_token, publicKey, {
          issuer: ISSUER,
          audience: CLIENT_ID,
        });

        // Assert
        expect(payload).toHaveProperty('sub');
        expect(typeof payload.sub).toBe('string');
      });

      it('서명 검증 후 payload에 email 클레임이 있어야 한다', async () => {
        // Arrange
        const redirectUri = 'http://localhost:3000/api/auth/oidc/callback';
        const authParams = new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: 'code',
          state: 'email-verify-state',
          scope: 'openid email',
        });
        const authRes = await httpGet(`/authorize?${authParams.toString()}`);
        const code = new URL(authRes.headers['location'] as string).searchParams.get('code') as string;

        const tokenRes = await httpPost('/token', {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });
        const { id_token } = JSON.parse(tokenRes.body);

        const jwksRes = await httpGet('/jwks');
        const jwk = JSON.parse(jwksRes.body).keys[0];
        const publicKey = await importJWK(jwk, 'RS256');

        // Act
        const { payload } = await jwtVerify(id_token, publicKey, {
          issuer: ISSUER,
          audience: CLIENT_ID,
        });

        // Assert
        expect(payload).toHaveProperty('email');
        expect(typeof payload.email).toBe('string');
        expect(payload.email as string).toContain('@');
      });

      it('다른 키로 서명된 토큰은 /jwks 공개키로 검증에 실패해야 한다', async () => {
        // Arrange — 외부 키로 직접 서명한 가짜 토큰 생성
        const { generateKeyPair, SignJWT } = await import('jose');
        const { privateKey: otherPrivateKey } = await generateKeyPair('RS256');
        const fakeToken = await new SignJWT({ sub: 'fake-user', email: 'fake@example.com' })
          .setProtectedHeader({ alg: 'RS256' })
          .setIssuedAt()
          .setExpirationTime('1h')
          .setIssuer(ISSUER)
          .setAudience(CLIENT_ID)
          .sign(otherPrivateKey);

        // /jwks 공개키 획득
        const jwksRes = await httpGet('/jwks');
        const jwk = JSON.parse(jwksRes.body).keys[0];
        const publicKey = await importJWK(jwk, 'RS256');

        // Act & Assert — 서명 검증이 실패해야 함
        await expect(
          jwtVerify(fakeToken, publicKey, { issuer: ISSUER, audience: CLIENT_ID })
        ).rejects.toThrow();
      });
    });

    // ------------------------------------------------------------
    // Authorization Code Flow 전체 흐름
    // ------------------------------------------------------------
    describe('Authorization Code Flow 전체 흐름', () => {
      it('authorize → token → jwks 검증 전체 흐름이 성공해야 한다', async () => {
        // Arrange
        const redirectUri = 'http://localhost:3000/api/auth/oidc/callback';
        const state = 'full-flow-state-001';

        // Step 1: /authorize — code 요청
        const authParams = new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: redirectUri,
          response_type: 'code',
          state,
          scope: 'openid email',
        });
        const authRes = await httpGet(`/authorize?${authParams.toString()}`);
        expect(authRes.statusCode).toBe(302);

        const location = authRes.headers['location'] as string;
        const locationUrl = new URL(location);
        expect(locationUrl.searchParams.get('state')).toBe(state);

        const code = locationUrl.searchParams.get('code') as string;
        expect(code).toBeTruthy();

        // Step 2: /token — code를 id_token으로 교환
        const tokenRes = await httpPost('/token', {
          grant_type: 'authorization_code',
          code,
          redirect_uri: redirectUri,
          client_id: CLIENT_ID,
        });
        expect(tokenRes.statusCode).toBe(200);

        const tokenBody = JSON.parse(tokenRes.body);
        expect(tokenBody).toHaveProperty('id_token');
        expect(tokenBody).toHaveProperty('access_token');

        // Step 3: /jwks — 공개키 획득 후 id_token 서명 검증
        const jwksRes = await httpGet('/jwks');
        expect(jwksRes.statusCode).toBe(200);

        const jwk = JSON.parse(jwksRes.body).keys[0];
        const publicKey = await importJWK(jwk, 'RS256');

        const { payload } = await jwtVerify(tokenBody.id_token, publicKey, {
          issuer: ISSUER,
          audience: CLIENT_ID,
        });

        // Assert — 최종 payload 검증
        expect(payload.iss).toBe(ISSUER);
        expect(payload.sub).toBeTruthy();
        expect(payload.email).toBeTruthy();
      });

      it('두 번의 독립적인 Authorization Code Flow가 각각 성공해야 한다', async () => {
        // Arrange
        const redirectUri = 'http://localhost:3000/api/auth/oidc/callback';

        const runFlow = async (state: string) => {
          const authParams = new URLSearchParams({
            client_id: CLIENT_ID,
            redirect_uri: redirectUri,
            response_type: 'code',
            state,
            scope: 'openid email',
          });
          const authRes = await httpGet(`/authorize?${authParams.toString()}`);
          const code = new URL(authRes.headers['location'] as string).searchParams.get('code') as string;

          const tokenRes = await httpPost('/token', {
            grant_type: 'authorization_code',
            code,
            redirect_uri: redirectUri,
            client_id: CLIENT_ID,
          });
          return JSON.parse(tokenRes.body);
        };

        // Act
        const [result1, result2] = await Promise.all([
          runFlow('parallel-state-1'),
          runFlow('parallel-state-2'),
        ]);

        // Assert — 두 흐름이 모두 독립적으로 성공
        expect(result1).toHaveProperty('id_token');
        expect(result2).toHaveProperty('id_token');
        expect(result1.id_token).not.toBe(result2.id_token);
      });

      it('discovery document의 endpoint URL로 실제 요청이 성공해야 한다', async () => {
        // Arrange — discovery document에서 endpoint URL 획득
        const discoveryRes = await httpGet('/.well-known/openid-configuration');
        const discovery = JSON.parse(discoveryRes.body);

        // authorization_endpoint에서 경로만 추출
        const authEndpointPath = new URL(discovery.authorization_endpoint).pathname;
        const tokenEndpointPath = new URL(discovery.token_endpoint).pathname;
        const jwksUriPath = new URL(discovery.jwks_uri).pathname;

        // Act — discovery에서 얻은 경로로 실제 요청
        const authParams = new URLSearchParams({
          client_id: CLIENT_ID,
          redirect_uri: 'http://localhost:3000/api/auth/oidc/callback',
          response_type: 'code',
          state: 'discovery-flow-state',
          scope: 'openid email',
        });
        const authRes = await httpGet(`${authEndpointPath}?${authParams.toString()}`);
        expect(authRes.statusCode).toBe(302);

        const code = new URL(authRes.headers['location'] as string).searchParams.get('code') as string;

        const tokenRes = await httpPost(tokenEndpointPath, {
          grant_type: 'authorization_code',
          code,
          redirect_uri: 'http://localhost:3000/api/auth/oidc/callback',
          client_id: CLIENT_ID,
        });
        expect(tokenRes.statusCode).toBe(200);

        const jwksRes = await httpGet(jwksUriPath);
        expect(jwksRes.statusCode).toBe(200);

        // Assert — discovery에서 얻은 jwks_uri로 id_token 검증 가능
        const jwk = JSON.parse(jwksRes.body).keys[0];
        const publicKey = await importJWK(jwk, 'RS256');
        const { id_token } = JSON.parse(tokenRes.body);

        const { payload } = await jwtVerify(id_token, publicKey, {
          issuer: ISSUER,
          audience: CLIENT_ID,
        });
        expect(payload.iss).toBe(ISSUER);
      });
    });

    // ------------------------------------------------------------
    // 알 수 없는 경로
    // ------------------------------------------------------------
    describe('알 수 없는 경로 처리', () => {
      it('정의되지 않은 경로는 404를 반환해야 한다', async () => {
        // Act
        const res = await httpGet('/unknown-endpoint');

        // Assert
        expect(res.statusCode).toBe(404);
      });
    });
  });
});
