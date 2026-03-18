/**
 * OIDC Mock 서버
 *
 * Authorization Code Flow를 지원하는 경량 OIDC Provider 모킹 서버입니다.
 * E2E 테스트 및 단위 테스트에서 실제 OIDC Provider 없이 인증 흐름을 검증할 수 있습니다.
 *
 * 지원 엔드포인트:
 *   GET  /.well-known/openid-configuration — OIDC Discovery Document
 *   GET  /authorize                        — Authorization Code 발급 (302 redirect)
 *   POST /token                            — Authorization Code → id_token 교환
 *   GET  /jwks                             — 공개키 JWK Set
 */

import http from 'http';
import { generateKeyPair, exportJWK, SignJWT } from 'jose';
import crypto from 'crypto';

// ----------------------------------------------------------------
// 내부 상태
// ----------------------------------------------------------------

/** 현재 실행 중인 HTTP 서버 인스턴스 */
let server: http.Server | null = null;

/** 서버가 바인딩된 포트 */
let currentPort: number | null = null;

/** RS256 서명에 사용할 개인키 */
let privateKey: CryptoKey | null = null;

/** RS256 서명 검증에 사용할 공개키 */
let publicKey: CryptoKey | null = null;

/** 발급된 Authorization Code를 저장하는 일회성 Map (code → { clientId, sub? }) */
const pendingCodes = new Map<string, { clientId: string; sub?: string }>();

// ----------------------------------------------------------------
// 헬퍼
// ----------------------------------------------------------------

/**
 * HTTP 응답을 JSON으로 전송합니다.
 */
function sendJson(res: http.ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * POST 요청의 body를 문자열로 읽습니다.
 */
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk: Buffer) => { data += chunk.toString(); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// ----------------------------------------------------------------
// 라우트 핸들러
// ----------------------------------------------------------------

/**
 * GET /.well-known/openid-configuration
 * OIDC Discovery Document를 반환합니다.
 */
function handleDiscovery(res: http.ServerResponse): void {
  const issuer = `http://localhost:${currentPort}`;
  sendJson(res, 200, {
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    jwks_uri: `${issuer}/jwks`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256'],
  });
}

/**
 * GET /authorize
 * Authorization Code를 발급하고 redirect_uri로 302 리다이렉트합니다.
 */
function handleAuthorize(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = new URL(req.url ?? '', `http://localhost:${currentPort}`);
  const redirectUri = url.searchParams.get('redirect_uri');
  const state = url.searchParams.get('state');
  const clientId = url.searchParams.get('client_id') ?? '';

  if (!redirectUri) {
    sendJson(res, 400, { error: 'redirect_uri is required' });
    return;
  }

  // 일회성 Authorization Code 생성
  const code = crypto.randomUUID();
  const sub = url.searchParams.get('sub') ?? undefined;
  pendingCodes.set(code, { clientId, sub });

  // redirect_uri?code=...&state=... 으로 302 리다이렉트
  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set('code', code);
  if (state) {
    redirectUrl.searchParams.set('state', state);
  }

  res.writeHead(302, { Location: redirectUrl.toString() });
  res.end();
}

/**
 * POST /token
 * Authorization Code를 id_token + access_token으로 교환합니다.
 */
async function handleToken(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const rawBody = await readBody(req);
  const params = new URLSearchParams(rawBody);

  const code = params.get('code');
  const clientId = params.get('client_id') ?? '';

  // code 유효성 확인
  if (!code || !pendingCodes.has(code)) {
    sendJson(res, 400, { error: 'invalid_grant', error_description: 'Invalid or expired code' });
    return;
  }

  // 일회성 사용: code 소진
  const codeData = pendingCodes.get(code)!;
  pendingCodes.delete(code);

  const issuer = `http://localhost:${currentPort}`;
  const sub = codeData.sub ?? crypto.randomUUID();
  const email = `user-${sub.slice(0, 8)}@mock.example.com`;
  const now = Math.floor(Date.now() / 1000);

  // RS256으로 id_token 서명
  const idToken = await new SignJWT({
    sub,
    email,
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600) // 1시간 후 만료
    .setIssuer(issuer)
    .setAudience(clientId)
    .sign(privateKey!);

  // access_token은 단순 불투명 토큰으로 발급
  const accessToken = crypto.randomUUID();

  sendJson(res, 200, {
    id_token: idToken,
    access_token: accessToken,
    token_type: 'Bearer',
  });
}

/**
 * GET /jwks
 * 공개키 JWK Set을 반환합니다. 개인키 정보(d 등)는 포함하지 않습니다.
 */
async function handleJwks(res: http.ServerResponse): Promise<void> {
  const jwk = await exportJWK(publicKey!);

  // 개인키 필드(d, p, q, dp, dq, qi)가 있으면 제거 (공개키만 노출)
  const { d: _d, p: _p, q: _q, dp: _dp, dq: _dq, qi: _qi, ...publicJwk } = jwk as typeof jwk & {
    d?: string; p?: string; q?: string; dp?: string; dq?: string; qi?: string;
  };

  sendJson(res, 200, {
    keys: [
      {
        ...publicJwk,
        kid: 'mock-key-1',
        use: 'sig',
        alg: 'RS256',
      },
    ],
  });
}

// ----------------------------------------------------------------
// 메인 요청 핸들러
// ----------------------------------------------------------------

async function requestHandler(
  req: http.IncomingMessage,
  res: http.ServerResponse
): Promise<void> {
  const url = new URL(req.url ?? '', `http://localhost:${currentPort}`);
  const pathname = url.pathname;
  const method = req.method?.toUpperCase();

  try {
    if (pathname === '/.well-known/openid-configuration' && method === 'GET') {
      handleDiscovery(res);
    } else if (pathname === '/authorize' && method === 'GET') {
      handleAuthorize(req, res);
    } else if (pathname === '/token' && method === 'POST') {
      await handleToken(req, res);
    } else if (pathname === '/jwks' && method === 'GET') {
      await handleJwks(res);
    } else {
      sendJson(res, 404, { error: 'not_found', path: pathname });
    }
  } catch (err) {
    sendJson(res, 500, { error: 'internal_server_error', message: String(err) });
  }
}

// ----------------------------------------------------------------
// 공개 API
// ----------------------------------------------------------------

/**
 * OIDC Mock 서버를 시작합니다.
 *
 * @param port - 서버를 바인딩할 포트 번호
 * @returns 서버가 준비되면 resolve되는 Promise
 */
export async function startOidcMockServer(port: number): Promise<void> {
  // 기존 서버가 있으면 먼저 종료
  if (server) {
    await stopOidcMockServer();
  }

  // RSA 키페어 생성 (RS256)
  const keyPair = await generateKeyPair('RS256');
  privateKey = keyPair.privateKey as CryptoKey;
  publicKey = keyPair.publicKey as CryptoKey;

  currentPort = port;
  pendingCodes.clear();

  return new Promise((resolve, reject) => {
    server = http.createServer(requestHandler);

    server.once('error', reject);

    server.listen(port, '127.0.0.1', () => {
      resolve();
    });
  });
}

/**
 * OIDC Mock 서버를 종료합니다.
 *
 * @returns 서버가 완전히 종료되면 resolve되는 Promise
 */
export async function stopOidcMockServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!server) {
      resolve();
      return;
    }

    const s = server;
    server = null;
    currentPort = null;
    privateKey = null;
    publicKey = null;
    pendingCodes.clear();

    s.close((err) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
}
