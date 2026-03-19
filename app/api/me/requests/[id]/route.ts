import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
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

  const { id } = await params;

  const found = await prisma.request.findUnique({
    where: { id },
  });

  if (!found) {
    return new Response(JSON.stringify({ error: 'Request not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // expiresAt 계산 (timeoutSeconds 기반)
  let expiresAt: string | null = null;
  if (found.timeoutSeconds != null) {
    const expiresAtDate = new Date(found.createdAt.getTime() + found.timeoutSeconds * 1000);
    expiresAt = expiresAtDate.toISOString();

    // PENDING 상태이고 만료됐으면 EXPIRED로 업데이트
    if (found.status === 'PENDING' && expiresAtDate <= new Date()) {
      await prisma.request.update({
        where: { id },
        data: { status: 'EXPIRED' },
      });

      return new Response(
        JSON.stringify({
          id: found.id,
          externalId: found.externalId,
          context: found.context,
          requesterName: found.requesterName,
          status: 'EXPIRED',
          timeoutSeconds: found.timeoutSeconds,
          expiresAt,
          createdAt: found.createdAt,
          processedAt: found.processedAt,
          processedById: found.processedById,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }
  }

  return new Response(
    JSON.stringify({
      id: found.id,
      externalId: found.externalId,
      context: found.context,
      requesterName: found.requesterName,
      status: found.status,
      timeoutSeconds: found.timeoutSeconds,
      expiresAt,
      createdAt: found.createdAt,
      processedAt: found.processedAt,
      processedById: found.processedById,
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
