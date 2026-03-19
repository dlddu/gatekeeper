import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(request: NextRequest): Promise<Response> {
  // Forward Auth: x-authentik-uid 헤더에서 사용자 식별
  const authentikUid = request.headers.get('x-authentik-uid');

  if (!authentikUid) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await prisma.user.findUnique({ where: { authentikUid } });

  if (!user) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다' }), {
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

  // 소유자 검증: 인증된 사용자만 자신의 구독을 삭제할 수 있음
  if (existing.userId !== user.id) {
    return new Response(JSON.stringify({ error: '해당 구독을 삭제할 권한이 없습니다' }), {
      status: 403,
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
