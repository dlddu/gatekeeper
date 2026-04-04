import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';

export type ForwardAuthUser = {
  id: string;
  username: string;
  email: string | null;
  autheliaId: string;
  displayName: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function getForwardAuthUser(request: NextRequest): Promise<ForwardAuthUser | null> {
  const autheliaId = request.headers.get('Remote-User');

  if (!autheliaId) {
    return null;
  }

  const username = autheliaId;
  const email = request.headers.get('Remote-Email');
  const displayName = request.headers.get('Remote-Name') ?? '';

  const existingUser = await prisma.user.findUnique({
    where: { autheliaId },
  });

  if (existingUser) {
    const updatedUser = await prisma.user.update({
      where: { autheliaId },
      data: { email, displayName },
    });
    return updatedUser;
  }

  // authentik → authelia 전환: 기존 사용자가 구 authentik UID로 등록되어 있을 수 있음
  // username으로 fallback 조회하여 autheliaId를 업데이트
  const existingByUsername = await prisma.user.findUnique({
    where: { username },
  });

  if (existingByUsername) {
    const updatedUser = await prisma.user.update({
      where: { username },
      data: { autheliaId, email, displayName },
    });
    return updatedUser;
  }

  const newUser = await prisma.user.create({
    data: { autheliaId, username, email, displayName },
  });

  return newUser;
}
