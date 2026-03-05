import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendPushNotifications } from '@/lib/push';

const VALID_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED'] as const;
type RequestStatus = typeof VALID_STATUSES[number];

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
  const { externalId, context, requesterName, timeoutSeconds, userId } = body;

  // 필수 필드 검증
  if (!externalId || !context || !requesterName) {
    return new Response(JSON.stringify({ error: 'externalId, context, and requesterName are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // userId가 제공된 경우 존재하는 사용자인지 검증
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  try {
    const now = new Date();
    const expiresAt = timeoutSeconds != null
      ? new Date(now.getTime() + timeoutSeconds * 1000)
      : null;

    const created = await prisma.request.create({
      data: {
        externalId,
        context,
        requesterName,
        timeoutSeconds: timeoutSeconds ?? null,
        expiresAt,
      },
    });

    // userId가 제공된 경우 해당 사용자에게 Push 알림 발송 시도
    if (userId) {
      try {
        const pushSubscriptions = await prisma.pushSubscription.findMany({
          where: { userId },
        });

        if (pushSubscriptions.length > 0) {
          await sendPushNotifications({
            subscriptions: pushSubscriptions,
            title: '승인 요청이 도착했습니다',
            body: context,
            onExpired: async (endpoint) => {
              await prisma.pushSubscription.delete({ where: { endpoint } });
            },
          });
        }
      } catch {
        // Push 발송 실패는 요청 생성 결과에 영향을 주지 않음
      }
    }

    return new Response(
      JSON.stringify({
        id: created.id,
        externalId: created.externalId,
        context: created.context,
        requesterName: created.requesterName,
        status: created.status,
        timeoutSeconds: created.timeoutSeconds,
        expiresAt: created.expiresAt,
        createdAt: created.createdAt,
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code: string }).code === 'P2002'
    ) {
      return new Response(JSON.stringify({ error: 'Request with this externalId already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw error;
  }
}

export async function GET(request: NextRequest): Promise<Response> {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status');

  // status 파라미터 검증
  if (status !== null) {
    if (!VALID_STATUSES.includes(status as RequestStatus)) {
      return new Response(JSON.stringify({ error: `Invalid status value: ${status}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  const where = status ? { status: status as RequestStatus } : {};

  const requests = await prisma.request.findMany({
    where,
    orderBy: { createdAt: 'desc' },
  });

  return new Response(JSON.stringify(requests), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
