import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function DELETE(request: NextRequest): Promise<Response> {
  // JWT 인증
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const token = authHeader.substring(7);

  try {
    await verifyToken(token);
  } catch {
    return new Response(JSON.stringify({ error: '유효하지 않은 토큰입니다' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { endpoint } = body;

  // endpoint 존재 여부 확인
  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint },
  });

  if (!existing) {
    return new Response(JSON.stringify({ error: '구독 정보를 찾을 수 없습니다' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 구독 삭제
  await prisma.pushSubscription.delete({
    where: { endpoint },
  });

  return new Response(JSON.stringify({ message: '구독이 해제되었습니다' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
