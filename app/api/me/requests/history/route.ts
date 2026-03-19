import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest): Promise<Response> {
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

  // 쿼리 파라미터 파싱
  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit');
  const cursor = searchParams.get('cursor');

  const limit = limitParam ? parseInt(limitParam, 10) : 10;
  const take = limit + 1; // hasMore 판별을 위해 +1

  // Prisma 쿼리 옵션 구성
  const queryArgs: Prisma.RequestFindManyArgs = {
    where: {
      status: {
        in: ['APPROVED', 'REJECTED', 'EXPIRED'],
      },
    },
    orderBy: { processedAt: 'desc' },
    take,
  };

  if (cursor) {
    queryArgs.cursor = { id: cursor };
    queryArgs.skip = 1;
  }

  const rows = await prisma.request.findMany(queryArgs);

  // hasMore 판별
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  const result = items.map((req) => ({
    id: req.id,
    externalId: req.externalId,
    status: req.status,
    processedAt: req.processedAt,
    context: req.context,
    requesterName: req.requesterName,
    createdAt: req.createdAt,
  }));

  return new Response(
    JSON.stringify({ items: result, hasMore, nextCursor }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
