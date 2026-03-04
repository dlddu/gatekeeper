import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest): Promise<Response> {
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

  // PENDING 상태 요청 목록 조회 (createdAt 최신순)
  const pendingRequests = await prisma.request.findMany({
    where: { status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();
  const result = [];

  for (const req of pendingRequests) {
    // expiresAt 계산
    let expiresAt: string | null = null;
    if (req.timeoutSeconds != null) {
      const expiresAtDate = new Date(req.createdAt.getTime() + req.timeoutSeconds * 1000);
      expiresAt = expiresAtDate.toISOString();

      // 만료된 요청은 EXPIRED로 업데이트하고 목록에서 제외
      if (expiresAtDate <= now) {
        await prisma.request.update({
          where: { id: req.id },
          data: { status: 'EXPIRED' },
        });
        continue;
      }
    }

    result.push({
      id: req.id,
      externalId: req.externalId,
      context: req.context,
      requesterName: req.requesterName,
      status: req.status,
      timeoutSeconds: req.timeoutSeconds,
      createdAt: req.createdAt,
      expiresAt,
    });
  }

  return new Response(
    JSON.stringify({ requests: result, count: result.length }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
