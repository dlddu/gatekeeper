import { NextRequest, NextResponse } from 'next/server';

// 인증이 필요없는 공개 경로
const publicPaths = [
  '/api/health',
  '/api/requests',
  '/_next',
  '/favicon.ico',
];

function isPublicPath(pathname: string): boolean {
  return publicPaths.some((path) => pathname.startsWith(path));
}

export async function middleware(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // 공개 경로는 인증 없이 통과
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // E2E 테스트 환경: Forward Auth 헤더를 자동 주입 (프로덕션에서는 절대 실행되지 않음)
  const e2eUser = process.env.E2E_FORWARD_AUTH_USER;
  if (e2eUser && process.env.NODE_ENV !== 'production') {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-authentik-uid', e2eUser);
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Forward Auth 환경: Traefik이 인증을 처리하므로 요청을 그대로 통과
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
