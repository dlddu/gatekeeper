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

  // /api/* 경로에서는 Remote-User 헤더 존재 여부 확인
  if (pathname.startsWith('/api/')) {
    const remoteUser = request.headers.get('Remote-User');
    if (!remoteUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
