import { NextRequest } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get('authorization');

  // Authorization 헤더 없거나 Bearer 형식이 아님 → 401
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized: No token provided' }), {
      status: 401,
    });
  }

  // Bearer 접두사 제거하여 순수 토큰 추출
  const token = authHeader.slice('Bearer '.length);

  try {
    // 기존 토큰 검증
    const payload = await verifyToken(token);

    // 새 토큰 발급
    const newToken = await signToken({ userId: payload.userId, username: payload.username });

    return new Response(JSON.stringify({ token: newToken }), { status: 200 });
  } catch {
    return new Response(JSON.stringify({ error: 'Unauthorized: Invalid or expired token' }), {
      status: 401,
    });
  }
}
