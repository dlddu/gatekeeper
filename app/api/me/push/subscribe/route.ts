import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest): Promise<Response> {
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
  const { endpoint, keys } = body;

  // flat 형태(p256dh, auth 직접 전달) 및 keys 객체 형태 모두 지원
  const p256dh = keys?.p256dh || body.p256dh;
  const auth = keys?.auth || body.auth;

  // 필수 필드 검증
  if (!endpoint || !p256dh || !auth) {
    return new Response(JSON.stringify({ error: 'endpoint, p256dh, auth는 필수입니다' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 중복 endpoint 확인
  const existing = await prisma.pushSubscription.findUnique({
    where: { endpoint },
  });

  if (existing) {
    return new Response(JSON.stringify(existing), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 새 구독 등록
  const subscription = await prisma.pushSubscription.create({
    data: {
      userId: user.id,
      endpoint,
      p256dh,
      auth,
    },
  });

  return new Response(JSON.stringify(subscription), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  });
}
