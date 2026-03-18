import { jwtVerify, createRemoteJWKSet } from 'jose';

export interface OIDCConfig {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
}

const discoveryCache = new Map<string, OIDCConfig>();

export async function discoverOIDC(issuer: string): Promise<OIDCConfig> {
  const cached = discoveryCache.get(issuer);
  if (cached) {
    return cached;
  }

  const response = await fetch(`${issuer}/.well-known/openid-configuration`);

  if (!response.ok) {
    throw new Error(
      `OIDC discovery failed: HTTP ${response.status} from ${issuer}/.well-known/openid-configuration`
    );
  }

  const config = (await response.json()) as OIDCConfig;
  discoveryCache.set(issuer, config);
  return config;
}

export async function buildAuthorizationURL(
  state: string,
  nonce: string
): Promise<string> {
  const issuer = process.env.OIDC_ISSUER;
  if (!issuer) {
    throw new Error('OIDC_ISSUER environment variable is not set');
  }

  const clientId = process.env.OIDC_CLIENT_ID;
  if (!clientId) {
    throw new Error('OIDC_CLIENT_ID environment variable is not set');
  }

  const redirectUri = process.env.OIDC_REDIRECT_URI;
  if (!redirectUri) {
    throw new Error('OIDC_REDIRECT_URI environment variable is not set');
  }

  const config = await discoverOIDC(issuer);

  const url = new URL(config.authorization_endpoint);
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'openid email');
  url.searchParams.set('state', state);
  url.searchParams.set('nonce', nonce);

  return url.toString();
}

export async function exchangeCode(
  code: string
): Promise<{ id_token: string; access_token: string }> {
  const issuer = process.env.OIDC_ISSUER;
  if (!issuer) {
    throw new Error('OIDC_ISSUER environment variable is not set');
  }

  const clientId = process.env.OIDC_CLIENT_ID;
  if (!clientId) {
    throw new Error('OIDC_CLIENT_ID environment variable is not set');
  }

  const clientSecret = process.env.OIDC_CLIENT_SECRET;
  if (!clientSecret) {
    throw new Error('OIDC_CLIENT_SECRET environment variable is not set');
  }

  const redirectUri = process.env.OIDC_REDIRECT_URI;
  if (!redirectUri) {
    throw new Error('OIDC_REDIRECT_URI environment variable is not set');
  }

  const config = await discoverOIDC(issuer);

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(config.token_endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error(
      `Token exchange failed: HTTP ${response.status} from ${config.token_endpoint}`
    );
  }

  const tokenResponse = (await response.json()) as {
    id_token: string;
    access_token: string;
  };

  return {
    id_token: tokenResponse.id_token,
    access_token: tokenResponse.access_token,
  };
}

export async function verifyIdToken(
  idToken: string,
  nonce: string
): Promise<{ sub: string; email?: string }> {
  const issuer = process.env.OIDC_ISSUER;
  if (!issuer) {
    throw new Error('OIDC_ISSUER environment variable is not set');
  }

  const clientId = process.env.OIDC_CLIENT_ID;
  if (!clientId) {
    throw new Error('OIDC_CLIENT_ID environment variable is not set');
  }

  const config = await discoverOIDC(issuer);

  const jwks = createRemoteJWKSet(new URL(config.jwks_uri));

  const { payload } = await jwtVerify(idToken, jwks, {
    issuer,
    audience: clientId,
  });

  const tokenNonce = payload['nonce'] as string | undefined;
  if (tokenNonce !== nonce) {
    throw new Error(
      `Nonce mismatch: expected "${nonce}", got "${tokenNonce}"`
    );
  }

  return {
    sub: payload.sub as string,
    email: payload['email'] as string | undefined,
  };
}
