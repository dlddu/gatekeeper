import { NextRequest, NextResponse } from 'next/server';
import { buildAuthorizationURL } from '@/lib/oidc';

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();

  const authUrl = await buildAuthorizationURL(state, nonce);

  const response = NextResponse.redirect(new URL(authUrl), { status: 302 });

  response.cookies.set('oidc_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  });

  response.cookies.set('oidc_nonce', nonce, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 300,
  });

  return response;
}
