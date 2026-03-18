/**
 * OIDC 유틸리티 테스트 (jose 기반)
 *
 * lib/oidc.ts의 discoverOIDC / buildAuthorizationURL / exchangeCode / verifyIdToken
 * 함수를 검증합니다.
 *
 * TDD Red Phase: lib/oidc.ts가 아직 없으므로 import는 실패하지만,
 * 구현 후 모든 테스트가 통과해야 합니다.
 */

import {
  discoverOIDC,
  buildAuthorizationURL,
  exchangeCode,
  verifyIdToken,
  clearDiscoveryCache,
} from '@/lib/oidc';

// ----------------------------------------------------------------
// 공통 픽스처
// ----------------------------------------------------------------

const TEST_ISSUER = 'https://auth.example.com';
const TEST_CLIENT_ID = 'test-client-id';
const TEST_CLIENT_SECRET = 'test-client-secret';
const TEST_REDIRECT_URI = 'https://app.example.com/callback';

/** OIDC Discovery 응답 픽스처 */
const MOCK_OIDC_CONFIG = {
  issuer: TEST_ISSUER,
  authorization_endpoint: `${TEST_ISSUER}/authorize`,
  token_endpoint: `${TEST_ISSUER}/token`,
  jwks_uri: `${TEST_ISSUER}/.well-known/jwks.json`,
  userinfo_endpoint: `${TEST_ISSUER}/userinfo`,
  response_types_supported: ['code'],
  subject_types_supported: ['public'],
  id_token_signing_alg_values_supported: ['RS256'],
};

// ----------------------------------------------------------------
// 환경변수 관리 헬퍼
// ----------------------------------------------------------------

function setOidcEnv() {
  process.env.OIDC_ISSUER = TEST_ISSUER;
  process.env.OIDC_CLIENT_ID = TEST_CLIENT_ID;
  process.env.OIDC_CLIENT_SECRET = TEST_CLIENT_SECRET;
  process.env.OIDC_REDIRECT_URI = TEST_REDIRECT_URI;
}

function clearOidcEnv() {
  delete process.env.OIDC_ISSUER;
  delete process.env.OIDC_CLIENT_ID;
  delete process.env.OIDC_CLIENT_SECRET;
  delete process.env.OIDC_REDIRECT_URI;
}

// ----------------------------------------------------------------
// fetch mock 헬퍼
// ----------------------------------------------------------------

/**
 * global.fetch를 성공 응답으로 mock합니다.
 */
function mockFetchSuccess(body: unknown, status = 200) {
  (global.fetch as jest.Mock).mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

/**
 * global.fetch를 네트워크 오류로 mock합니다.
 */
function mockFetchNetworkError(message = 'Network Error') {
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(message));
}

/**
 * global.fetch를 HTTP 오류 응답으로 mock합니다.
 */
function mockFetchHttpError(status: number, body: unknown = { error: 'error' }) {
  (global.fetch as jest.Mock).mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  );
}

// ----------------------------------------------------------------
// discoverOIDC
// ----------------------------------------------------------------

describe('discoverOIDC', () => {
  beforeEach(() => {
    setOidcEnv();
    // global.fetch를 jest.fn()으로 교체
    global.fetch = jest.fn();
    clearDiscoveryCache();
  });

  afterEach(() => {
    clearOidcEnv();
    jest.restoreAllMocks();
  });

  it('should fetch /.well-known/openid-configuration from the issuer URL', async () => {
    // Arrange
    mockFetchSuccess(MOCK_OIDC_CONFIG);

    // Act
    await discoverOIDC(TEST_ISSUER);

    // Assert
    expect(global.fetch).toHaveBeenCalledWith(
      `${TEST_ISSUER}/.well-known/openid-configuration`
    );
  });

  it('should return authorization_endpoint from the discovery document', async () => {
    // Arrange
    mockFetchSuccess(MOCK_OIDC_CONFIG);

    // Act
    const config = await discoverOIDC(TEST_ISSUER);

    // Assert
    expect(config.authorization_endpoint).toBe(MOCK_OIDC_CONFIG.authorization_endpoint);
  });

  it('should return token_endpoint from the discovery document', async () => {
    // Arrange
    mockFetchSuccess(MOCK_OIDC_CONFIG);

    // Act
    const config = await discoverOIDC(TEST_ISSUER);

    // Assert
    expect(config.token_endpoint).toBe(MOCK_OIDC_CONFIG.token_endpoint);
  });

  it('should return jwks_uri from the discovery document', async () => {
    // Arrange
    mockFetchSuccess(MOCK_OIDC_CONFIG);

    // Act
    const config = await discoverOIDC(TEST_ISSUER);

    // Assert
    expect(config.jwks_uri).toBe(MOCK_OIDC_CONFIG.jwks_uri);
  });

  it('should cache the result and not call fetch again for the same issuer', async () => {
    // Arrange — fetch는 한 번만 응답을 준비
    mockFetchSuccess(MOCK_OIDC_CONFIG);

    // Act — 동일 issuer로 두 번 호출
    const first = await discoverOIDC(TEST_ISSUER);
    const second = await discoverOIDC(TEST_ISSUER);

    // Assert — fetch는 정확히 1회만 호출
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(first).toEqual(second);
  });

  it('should fetch again for a different issuer', async () => {
    // Arrange
    const anotherIssuer = 'https://other-auth.example.com';
    const anotherConfig = { ...MOCK_OIDC_CONFIG, issuer: anotherIssuer };
    mockFetchSuccess(MOCK_OIDC_CONFIG);
    mockFetchSuccess(anotherConfig);

    // Act
    await discoverOIDC(TEST_ISSUER);
    await discoverOIDC(anotherIssuer);

    // Assert — 서로 다른 issuer이므로 fetch가 2회 호출
    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      `${anotherIssuer}/.well-known/openid-configuration`
    );
  });

  it('should throw when fetch fails with a network error', async () => {
    // Arrange
    mockFetchNetworkError('Failed to connect');

    // Act & Assert
    await expect(discoverOIDC(TEST_ISSUER)).rejects.toThrow();
  });

  it('should throw when the discovery endpoint returns a non-2xx status', async () => {
    // Arrange
    mockFetchHttpError(404, { error: 'not found' });

    // Act & Assert
    await expect(discoverOIDC(TEST_ISSUER)).rejects.toThrow();
  });
});

// ----------------------------------------------------------------
// buildAuthorizationURL
// ----------------------------------------------------------------

describe('buildAuthorizationURL', () => {
  beforeEach(() => {
    setOidcEnv();
    global.fetch = jest.fn();
    clearDiscoveryCache();
    // discoverOIDC 호출 시 항상 MOCK_OIDC_CONFIG 반환
    mockFetchSuccess(MOCK_OIDC_CONFIG);
  });

  afterEach(() => {
    clearOidcEnv();
    jest.restoreAllMocks();
  });

  it('should return a string URL', async () => {
    // Arrange
    const state = 'random-state-value';
    const nonce = 'random-nonce-value';

    // Act
    const url = await buildAuthorizationURL(state, nonce);

    // Assert
    expect(typeof url).toBe('string');
    expect(url.length).toBeGreaterThan(0);
  });

  it('should use the authorization_endpoint from OIDC discovery as the base URL', async () => {
    // Arrange
    const state = 'state-abc';
    const nonce = 'nonce-xyz';

    // Act
    const url = await buildAuthorizationURL(state, nonce);

    // Assert
    expect(url).toContain(MOCK_OIDC_CONFIG.authorization_endpoint);
  });

  it('should include response_type=code parameter', async () => {
    // Arrange & Act
    const url = await buildAuthorizationURL('state', 'nonce');
    const parsed = new URL(url);

    // Assert
    expect(parsed.searchParams.get('response_type')).toBe('code');
  });

  it('should include client_id from OIDC_CLIENT_ID env var', async () => {
    // Arrange & Act
    const url = await buildAuthorizationURL('state', 'nonce');
    const parsed = new URL(url);

    // Assert
    expect(parsed.searchParams.get('client_id')).toBe(TEST_CLIENT_ID);
  });

  it('should include redirect_uri from OIDC_REDIRECT_URI env var', async () => {
    // Arrange & Act
    const url = await buildAuthorizationURL('state', 'nonce');
    const parsed = new URL(url);

    // Assert
    expect(parsed.searchParams.get('redirect_uri')).toBe(TEST_REDIRECT_URI);
  });

  it('should include scope containing openid', async () => {
    // Arrange & Act
    const url = await buildAuthorizationURL('state', 'nonce');
    const parsed = new URL(url);
    const scope = parsed.searchParams.get('scope') ?? '';

    // Assert
    expect(scope).toContain('openid');
  });

  it('should include scope containing email', async () => {
    // Arrange & Act
    const url = await buildAuthorizationURL('state', 'nonce');
    const parsed = new URL(url);
    const scope = parsed.searchParams.get('scope') ?? '';

    // Assert
    expect(scope).toContain('email');
  });

  it('should include the provided state parameter', async () => {
    // Arrange
    const state = 'unique-state-12345';

    // Act
    const url = await buildAuthorizationURL(state, 'nonce');
    const parsed = new URL(url);

    // Assert
    expect(parsed.searchParams.get('state')).toBe(state);
  });

  it('should include the provided nonce parameter', async () => {
    // Arrange
    const nonce = 'unique-nonce-67890';

    // Act
    const url = await buildAuthorizationURL('state', nonce);
    const parsed = new URL(url);

    // Assert
    expect(parsed.searchParams.get('nonce')).toBe(nonce);
  });

  it('should throw when OIDC_CLIENT_ID is not set', async () => {
    // Arrange
    delete process.env.OIDC_CLIENT_ID;
    // discovery mock을 한 번 더 준비 (beforeEach 이후 추가 호출 대비)
    mockFetchSuccess(MOCK_OIDC_CONFIG);

    // Act & Assert
    await expect(buildAuthorizationURL('state', 'nonce')).rejects.toThrow();
  });

  it('should throw when OIDC_REDIRECT_URI is not set', async () => {
    // Arrange
    delete process.env.OIDC_REDIRECT_URI;
    mockFetchSuccess(MOCK_OIDC_CONFIG);

    // Act & Assert
    await expect(buildAuthorizationURL('state', 'nonce')).rejects.toThrow();
  });

  it('should throw when OIDC_ISSUER is not set', async () => {
    // Arrange
    delete process.env.OIDC_ISSUER;

    // Act & Assert
    await expect(buildAuthorizationURL('state', 'nonce')).rejects.toThrow();
  });
});

// ----------------------------------------------------------------
// exchangeCode
// ----------------------------------------------------------------

describe('exchangeCode', () => {
  const MOCK_TOKEN_RESPONSE = {
    id_token: 'mock.id.token',
    access_token: 'mock-access-token',
    token_type: 'Bearer',
    expires_in: 3600,
  };

  beforeEach(() => {
    setOidcEnv();
    global.fetch = jest.fn();
    clearDiscoveryCache();
    // 첫 번째 fetch: discoverOIDC
    mockFetchSuccess(MOCK_OIDC_CONFIG);
  });

  afterEach(() => {
    clearOidcEnv();
    jest.restoreAllMocks();
  });

  it('should return id_token and access_token on success', async () => {
    // Arrange
    mockFetchSuccess(MOCK_TOKEN_RESPONSE);

    // Act
    const result = await exchangeCode('auth-code-abc');

    // Assert
    expect(result).toHaveProperty('id_token');
    expect(result).toHaveProperty('access_token');
  });

  it('should return the id_token from the token endpoint response', async () => {
    // Arrange
    mockFetchSuccess(MOCK_TOKEN_RESPONSE);

    // Act
    const result = await exchangeCode('auth-code-abc');

    // Assert
    expect(result.id_token).toBe(MOCK_TOKEN_RESPONSE.id_token);
  });

  it('should return the access_token from the token endpoint response', async () => {
    // Arrange
    mockFetchSuccess(MOCK_TOKEN_RESPONSE);

    // Act
    const result = await exchangeCode('auth-code-abc');

    // Assert
    expect(result.access_token).toBe(MOCK_TOKEN_RESPONSE.access_token);
  });

  it('should POST to the token_endpoint', async () => {
    // Arrange
    mockFetchSuccess(MOCK_TOKEN_RESPONSE);

    // Act
    await exchangeCode('auth-code-abc');

    // Assert — 두 번째 fetch 호출이 token_endpoint로의 POST여야 함
    const calls = (global.fetch as jest.Mock).mock.calls;
    const tokenCall = calls.find(
      ([url]: [string]) => url === MOCK_OIDC_CONFIG.token_endpoint
    );
    expect(tokenCall).toBeDefined();
    expect(tokenCall[1].method).toBe('POST');
  });

  it('should send Content-Type: application/x-www-form-urlencoded', async () => {
    // Arrange
    mockFetchSuccess(MOCK_TOKEN_RESPONSE);

    // Act
    await exchangeCode('auth-code-abc');

    // Assert
    const calls = (global.fetch as jest.Mock).mock.calls;
    const tokenCall = calls.find(
      ([url]: [string]) => url === MOCK_OIDC_CONFIG.token_endpoint
    );
    expect(tokenCall).toBeDefined();
    const contentType: string =
      tokenCall[1].headers?.['Content-Type'] ??
      tokenCall[1].headers?.['content-type'] ??
      '';
    expect(contentType).toContain('application/x-www-form-urlencoded');
  });

  it('should include grant_type=authorization_code in the request body', async () => {
    // Arrange
    mockFetchSuccess(MOCK_TOKEN_RESPONSE);

    // Act
    await exchangeCode('auth-code-abc');

    // Assert
    const calls = (global.fetch as jest.Mock).mock.calls;
    const tokenCall = calls.find(
      ([url]: [string]) => url === MOCK_OIDC_CONFIG.token_endpoint
    );
    expect(tokenCall).toBeDefined();
    const body: string = tokenCall[1].body;
    expect(body).toContain('grant_type=authorization_code');
  });

  it('should include the authorization code in the request body', async () => {
    // Arrange
    const code = 'unique-auth-code-xyz';
    mockFetchSuccess(MOCK_TOKEN_RESPONSE);

    // Act
    await exchangeCode(code);

    // Assert
    const calls = (global.fetch as jest.Mock).mock.calls;
    const tokenCall = calls.find(
      ([url]: [string]) => url === MOCK_OIDC_CONFIG.token_endpoint
    );
    expect(tokenCall).toBeDefined();
    const body: string = tokenCall[1].body;
    expect(body).toContain(`code=${code}`);
  });

  it('should include client_id in the request body', async () => {
    // Arrange
    mockFetchSuccess(MOCK_TOKEN_RESPONSE);

    // Act
    await exchangeCode('auth-code-abc');

    // Assert
    const calls = (global.fetch as jest.Mock).mock.calls;
    const tokenCall = calls.find(
      ([url]: [string]) => url === MOCK_OIDC_CONFIG.token_endpoint
    );
    const body: string = tokenCall[1].body;
    expect(body).toContain(`client_id=${TEST_CLIENT_ID}`);
  });

  it('should include client_secret in the request body', async () => {
    // Arrange
    mockFetchSuccess(MOCK_TOKEN_RESPONSE);

    // Act
    await exchangeCode('auth-code-abc');

    // Assert
    const calls = (global.fetch as jest.Mock).mock.calls;
    const tokenCall = calls.find(
      ([url]: [string]) => url === MOCK_OIDC_CONFIG.token_endpoint
    );
    const body: string = tokenCall[1].body;
    expect(body).toContain(`client_secret=${TEST_CLIENT_SECRET}`);
  });

  it('should include redirect_uri in the request body', async () => {
    // Arrange
    mockFetchSuccess(MOCK_TOKEN_RESPONSE);

    // Act
    await exchangeCode('auth-code-abc');

    // Assert
    const calls = (global.fetch as jest.Mock).mock.calls;
    const tokenCall = calls.find(
      ([url]: [string]) => url === MOCK_OIDC_CONFIG.token_endpoint
    );
    const body: string = tokenCall[1].body;
    expect(body).toContain('redirect_uri=');
  });

  it('should throw when the token endpoint returns a non-2xx status', async () => {
    // Arrange
    mockFetchHttpError(400, { error: 'invalid_grant' });

    // Act & Assert
    await expect(exchangeCode('bad-code')).rejects.toThrow();
  });

  it('should throw when fetch fails with a network error', async () => {
    // Arrange
    mockFetchNetworkError('Connection refused');

    // Act & Assert
    await expect(exchangeCode('auth-code-abc')).rejects.toThrow();
  });

  it('should throw when OIDC_CLIENT_SECRET is not set', async () => {
    // Arrange
    delete process.env.OIDC_CLIENT_SECRET;
    mockFetchSuccess(MOCK_TOKEN_RESPONSE);

    // Act & Assert
    await expect(exchangeCode('auth-code-abc')).rejects.toThrow();
  });
});

// ----------------------------------------------------------------
// verifyIdToken
// ----------------------------------------------------------------

describe('verifyIdToken', () => {
  /**
   * 테스트용 RS256 키 쌍과 id_token을 동적으로 생성합니다.
   * jose의 generateKeyPair / SignJWT / exportJWK를 직접 사용합니다.
   */
  async function createTestIdToken(
    claims: Record<string, unknown>,
    options: { nonce?: string; overrideKid?: string } = {}
  ) {
    const { generateKeyPair, SignJWT, exportJWK } = await import('jose');

    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    const kid = options.overrideKid ?? 'test-key-id-1';

    const idToken = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_CLIENT_ID)
      .sign(privateKey);

    // JWKS 응답 — kid를 포함한 공개키
    const jwks = { keys: [{ ...jwk, kid, use: 'sig', alg: 'RS256' }] };

    return { idToken, jwks, privateKey, publicKey };
  }

  beforeEach(() => {
    setOidcEnv();
    global.fetch = jest.fn();
    clearDiscoveryCache();
  });

  afterEach(() => {
    clearOidcEnv();
    jest.restoreAllMocks();
  });

  it('should return sub claim for a valid id_token', async () => {
    // Arrange
    const nonce = 'test-nonce-abc';
    const { idToken, jwks } = await createTestIdToken({
      sub: 'user-sub-123',
      email: 'user@example.com',
      nonce,
    });
    // fetch 1: discoverOIDC, fetch 2: JWKS
    mockFetchSuccess(MOCK_OIDC_CONFIG);
    mockFetchSuccess(jwks);

    // Act
    const result = await verifyIdToken(idToken, nonce);

    // Assert
    expect(result.sub).toBe('user-sub-123');
  });

  it('should return email claim for a valid id_token', async () => {
    // Arrange
    const nonce = 'test-nonce-abc';
    const { idToken, jwks } = await createTestIdToken({
      sub: 'user-sub-456',
      email: 'alice@example.com',
      nonce,
    });
    mockFetchSuccess(MOCK_OIDC_CONFIG);
    mockFetchSuccess(jwks);

    // Act
    const result = await verifyIdToken(idToken, nonce);

    // Assert
    expect(result.email).toBe('alice@example.com');
  });

  it('should return undefined email when email claim is absent', async () => {
    // Arrange
    const nonce = 'test-nonce-abc';
    const { idToken, jwks } = await createTestIdToken({
      sub: 'user-sub-789',
      nonce,
      // email 클레임 없음
    });
    mockFetchSuccess(MOCK_OIDC_CONFIG);
    mockFetchSuccess(jwks);

    // Act
    const result = await verifyIdToken(idToken, nonce);

    // Assert
    expect(result.email).toBeUndefined();
  });

  it('should verify RS256 signature using the JWKS from jwks_uri', async () => {
    // Arrange — 정상 서명된 토큰
    const nonce = 'nonce-verify-sig';
    const { idToken, jwks } = await createTestIdToken({
      sub: 'user-sig-test',
      nonce,
    });
    mockFetchSuccess(MOCK_OIDC_CONFIG);
    mockFetchSuccess(jwks);

    // Act & Assert — 예외 없이 통과
    await expect(verifyIdToken(idToken, nonce)).resolves.toBeDefined();
  });

  it('should throw when the nonce in the token does not match', async () => {
    // Arrange
    const tokenNonce = 'correct-nonce';
    const wrongNonce = 'wrong-nonce';
    const { idToken, jwks } = await createTestIdToken({
      sub: 'user-nonce-mismatch',
      nonce: tokenNonce,
    });
    mockFetchSuccess(MOCK_OIDC_CONFIG);
    mockFetchSuccess(jwks);

    // Act & Assert
    await expect(verifyIdToken(idToken, wrongNonce)).rejects.toThrow();
  });

  it('should throw when the nonce claim is absent in the token', async () => {
    // Arrange — nonce 클레임 없이 발급
    const { idToken, jwks } = await createTestIdToken({
      sub: 'user-no-nonce',
      // nonce 없음
    });
    mockFetchSuccess(MOCK_OIDC_CONFIG);
    mockFetchSuccess(jwks);

    // Act & Assert
    await expect(verifyIdToken(idToken, 'expected-nonce')).rejects.toThrow();
  });

  it('should throw when the issuer does not match', async () => {
    // Arrange
    const { generateKeyPair, SignJWT, exportJWK } = await import('jose');
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    const kid = 'issuer-mismatch-kid';
    const jwks = { keys: [{ ...jwk, kid, use: 'sig', alg: 'RS256' }] };

    const nonce = 'nonce-issuer-test';
    const tokenWithWrongIssuer = await new SignJWT({ sub: 'user-x', nonce })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer('https://evil-auth.example.com') // 잘못된 issuer
      .setAudience(TEST_CLIENT_ID)
      .sign(privateKey);

    mockFetchSuccess(MOCK_OIDC_CONFIG);
    mockFetchSuccess(jwks);

    // Act & Assert
    await expect(verifyIdToken(tokenWithWrongIssuer, nonce)).rejects.toThrow();
  });

  it('should throw when the audience does not match', async () => {
    // Arrange
    const { generateKeyPair, SignJWT, exportJWK } = await import('jose');
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    const kid = 'audience-mismatch-kid';
    const jwks = { keys: [{ ...jwk, kid, use: 'sig', alg: 'RS256' }] };

    const nonce = 'nonce-audience-test';
    const tokenWithWrongAudience = await new SignJWT({ sub: 'user-y', nonce })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuedAt()
      .setExpirationTime('1h')
      .setIssuer(TEST_ISSUER)
      .setAudience('different-client-id') // 잘못된 audience
      .sign(privateKey);

    mockFetchSuccess(MOCK_OIDC_CONFIG);
    mockFetchSuccess(jwks);

    // Act & Assert
    await expect(verifyIdToken(tokenWithWrongAudience, nonce)).rejects.toThrow();
  });

  it('should throw when the token has an invalid signature', async () => {
    // Arrange — 유효한 토큰의 signature 부분을 변조
    const nonce = 'nonce-bad-sig';
    const { idToken, jwks } = await createTestIdToken({ sub: 'user-bad-sig', nonce });
    const parts = idToken.split('.');
    const tamperedToken = `${parts[0]}.${parts[1]}.tampered-signature-invalid`;

    mockFetchSuccess(MOCK_OIDC_CONFIG);
    mockFetchSuccess(jwks);

    // Act & Assert
    await expect(verifyIdToken(tamperedToken, nonce)).rejects.toThrow();
  });

  it('should throw when the token is expired', async () => {
    // Arrange
    const { generateKeyPair, SignJWT, exportJWK } = await import('jose');
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const jwk = await exportJWK(publicKey);
    const kid = 'expired-token-kid';
    const jwks = { keys: [{ ...jwk, kid, use: 'sig', alg: 'RS256' }] };

    const nonce = 'nonce-expired';
    const expiredToken = await new SignJWT({ sub: 'user-expired', nonce })
      .setProtectedHeader({ alg: 'RS256', kid })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200) // 2시간 전 발행
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600) // 1시간 전 만료
      .setIssuer(TEST_ISSUER)
      .setAudience(TEST_CLIENT_ID)
      .sign(privateKey);

    mockFetchSuccess(MOCK_OIDC_CONFIG);
    mockFetchSuccess(jwks);

    // Act & Assert
    await expect(verifyIdToken(expiredToken, nonce)).rejects.toThrow();
  });

  it('should throw for a completely malformed token string', async () => {
    // Arrange
    mockFetchSuccess(MOCK_OIDC_CONFIG);
    // JWKS 호출이 발생하기 전에 실패할 수 있으므로 mock을 준비
    mockFetchSuccess({ keys: [] });

    // Act & Assert
    await expect(verifyIdToken('not-a-jwt-at-all', 'some-nonce')).rejects.toThrow();
  });

  it('should throw when OIDC_ISSUER is not set', async () => {
    // Arrange
    delete process.env.OIDC_ISSUER;
    const nonce = 'nonce-no-issuer';

    // Act & Assert
    await expect(verifyIdToken('some.id.token', nonce)).rejects.toThrow();
  });

  it('should throw when OIDC_CLIENT_ID is not set', async () => {
    // Arrange
    delete process.env.OIDC_CLIENT_ID;
    const nonce = 'nonce-no-client-id';
    mockFetchSuccess(MOCK_OIDC_CONFIG);
    mockFetchSuccess({ keys: [] });

    // Act & Assert
    await expect(verifyIdToken('some.id.token', nonce)).rejects.toThrow();
  });
});
