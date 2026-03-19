import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  // Forward Auth: x-authentik-uid 헤더에서 사용자 식별
  const authentikUid = request.headers.get('x-authentik-uid');

  if (!authentikUid) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const user = await prisma.user.findUnique({ where: { authentikUid } });

  if (!user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id } = await params;

  const found = await prisma.request.findUnique({ where: { id } });

  if (!found) {
    return new Response(JSON.stringify({ error: 'Request not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (found.status === 'APPROVED' || found.status === 'REJECTED') {
    return new Response(JSON.stringify({ error: 'Request has already been processed' }), {
      status: 409,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const updated = await prisma.request.update({
    where: { id },
    data: {
      status: 'REJECTED',
      processedAt: new Date(),
      processedById: user.id,
    },
  });

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
