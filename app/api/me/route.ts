import { NextRequest, NextResponse } from 'next/server';
import { getForwardAuthUser } from '@/lib/forward-auth';

export async function GET(request: NextRequest): Promise<NextResponse> {
  const user = await getForwardAuthUser(request);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    autheliaId: user.autheliaId,
  });
}
