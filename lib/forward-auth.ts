import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export type ForwardAuthUser = {
  id: string;
  username: string;
  email: string | null;
  authentikUid: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function getForwardAuthUser(request: NextRequest): Promise<ForwardAuthUser | null> {
  const authentikUid = request.headers.get('x-authentik-uid');

  if (!authentikUid) {
    return null;
  }

  const username = request.headers.get('x-authentik-username') ?? '';
  const email = request.headers.get('x-authentik-email');
  const displayName = request.headers.get('x-authentik-name') ?? '';

  const existingUser = await prisma.user.findUnique({
    where: { authentikUid },
  });

  if (existingUser) {
    const updatedUser = await prisma.user.update({
      where: { authentikUid },
      data: { email, displayName },
    });
    return updatedUser;
  }

  const newUser = await prisma.user.create({
    data: { authentikUid, username, email, displayName },
  });

  return newUser;
}
