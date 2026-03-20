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

  // Forward Auth 환경: Traefik이 인증을 처리하므로 요청을 그대로 통과
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
