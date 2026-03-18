import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

// 인증이 필요없는 공개 경로
const publicPaths = [
  '/api/auth/login',
  '/api/auth/signup',
  '/api/auth/oidc/authorize',
  '/api/auth/oidc/callback',
  '/api/health',
  '/api/requests',
  '/_next',
  '/favicon.ico',
  '/login',
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

  // API 경로에 대한 JWT 인증
  if (pathname.startsWith('/api/')) {
    const authHeader = request.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized: No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.slice('Bearer '.length);

    try {
      await verifyToken(token);
      return NextResponse.next();
    } catch {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid or expired token' },
        { status: 401 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
