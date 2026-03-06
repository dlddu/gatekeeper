import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotifications } from '@/lib/push';

export async function POST(request: NextRequest): Promise<Response> {
  // API Key 인증
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { userId, title, body: notificationBody } = body;

  // 대상 사용자의 구독 목록 조회
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    return new Response(JSON.stringify({ success: true, sent: 0 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let sentCount = 0;

  await sendPushNotifications({
    subscriptions,
    title,
    body: notificationBody,
    onExpired: async (endpoint) => {
      await prisma.pushSubscription.delete({
        where: { endpoint },
      });
    },
    onSuccess: () => {
      sentCount++;
    },
  });

  return new Response(JSON.stringify({ success: true, sent: sentCount }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
