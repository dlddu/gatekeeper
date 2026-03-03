import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const apiKey = request.headers.get('x-api-key');
  if (!apiKey || apiKey !== process.env.API_SECRET_KEY) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
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

  if (found.status === 'PENDING' && found.expiresAt && new Date(found.expiresAt) < new Date()) {
    await prisma.request.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });

    return new Response(JSON.stringify({ ...found, status: 'EXPIRED' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(found), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
