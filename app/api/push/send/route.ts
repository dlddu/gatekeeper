import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push') as {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string
  ) => Promise<unknown>;
};

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

  // VAPID 설정
  const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? '';
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

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

  const payload = JSON.stringify({ title, body: notificationBody });
  let sentCount = 0;

  // 각 구독마다 개별적으로 발송 시도 (하나 실패해도 나머지 계속)
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload
      );
      sentCount++;
    } catch (error: unknown) {
      // 410 에러(구독 만료) 시 해당 구독을 DB에서 삭제
      if (
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        (error as { statusCode: number }).statusCode === 410
      ) {
        await prisma.pushSubscription.delete({
          where: { endpoint: subscription.endpoint },
        });
      }
      // 개별 발송 실패는 무시하고 계속 진행
    }
  }

  return new Response(JSON.stringify({ success: true, sent: sentCount }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
