import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.json();
  const { username, password, displayName } = body;

  // username, password, displayName 누락/빈문자열 → 400
  if (!username || !password || !displayName) {
    return new Response(
      JSON.stringify({ error: 'username, password, and displayName are required' }),
      { status: 400 }
    );
  }

  // 이미 존재하는 username → 409
  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) {
    return new Response(
      JSON.stringify({ error: 'Username already exists' }),
      { status: 409 }
    );
  }

  // 비밀번호 해싱
  const passwordHash = await bcrypt.hash(password, 10);

  // 사용자 생성
  const user = await prisma.user.create({
    data: {
      username,
      passwordHash,
      displayName,
    },
  });

  // JWT 발급
  const token = await signToken({ userId: user.id, username: user.username });

  return new Response(
    JSON.stringify({ token, userId: user.id, username: user.username }),
    { status: 201 }
  );
}
