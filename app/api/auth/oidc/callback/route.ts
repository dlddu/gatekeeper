import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, verifyIdToken } from '@/lib/oidc';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const oidcStateCookie = request.cookies.get('oidc_state');
  const oidcNonceCookie = request.cookies.get('oidc_nonce');

  // oidc_state 쿠키가 없으면 400
  if (!oidcStateCookie) {
    return NextResponse.json({ error: 'Missing state cookie' }, { status: 400 });
  }

  // state 불일치 시 400
  if (state !== oidcStateCookie.value) {
    return NextResponse.json({ error: 'State mismatch' }, { status: 400 });
  }

  const oidcNonce = oidcNonceCookie?.value ?? '';

  // 코드 교환
  let tokens: { id_token: string; access_token: string };
  try {
    tokens = await exchangeCode(code ?? '');
  } catch {
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 400 });
  }

  // ID 토큰 검증
  let claims: { sub: string; email?: string };
  try {
    claims = await verifyIdToken(tokens.id_token, oidcNonce);
  } catch {
    return NextResponse.json(
      { error: 'ID token verification failed' },
      { status: 400 }
    );
  }

  // DB에서 oidcSub로 사용자 조회 또는 신규 생성
  let user = await prisma.user.findUnique({
    where: { oidcSub: claims.sub },
  });

  if (!user) {
    // auto-provisioning: username 생성
    let username = claims.email
      ? claims.email.split('@')[0]
      : `oidc-${claims.sub.slice(0, 8)}`;

    // username 충돌 확인
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      username = `${username}-${claims.sub.slice(0, 8)}`;
    }

    user = await prisma.user.create({
      data: {
        username,
        passwordHash: null,
        email: claims.email,
        oidcSub: claims.sub,
        displayName: username,
      },
    });
  }

  // JWT 발급
  const jwt = await signToken({ userId: user.id, username: user.username });

  // state/nonce 쿠키 삭제 후 리다이렉트
  const redirectUrl = new URL(
    `/login/callback?token=${jwt}`,
    request.nextUrl.origin
  );
  const response = NextResponse.redirect(redirectUrl, { status: 302 });

  response.cookies.delete('oidc_state');
  response.cookies.delete('oidc_nonce');

  return response;
}
