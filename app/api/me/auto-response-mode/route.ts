import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getForwardAuthUser } from '@/lib/forward-auth';

const VALID_MODES = ['NONE', 'AUTO_APPROVE', 'AUTO_REJECT'] as const;
type AutoResponseMode = typeof VALID_MODES[number];

export async function PATCH(request: NextRequest): Promise<Response> {
  const user = await getForwardAuthUser(request);

  if (!user) {
    return new Response(JSON.stringify({ error: '인증이 필요합니다' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const body = await request.json();
  const { mode } = body;

  if (!mode || !VALID_MODES.includes(mode as AutoResponseMode)) {
    return new Response(
      JSON.stringify({ error: 'mode must be one of: NONE, AUTO_APPROVE, AUTO_REJECT' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { autoResponseMode: mode as AutoResponseMode },
  });

  return new Response(
    JSON.stringify({ autoResponseMode: updated.autoResponseMode }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
