import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

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
  const { externalId, context, requesterName, timeoutSeconds } = body;

  // 필수 필드 검증
  if (!externalId || !context || !requesterName) {
    return new Response(JSON.stringify({ error: 'externalId, context, and requesterName are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
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
