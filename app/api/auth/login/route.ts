import { NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import { signToken } from '@/lib/auth';

export async function POST(request: NextRequest): Promise<Response> {
  const body = await request.json();
  const { username, password } = body;

  // username 또는 password 누락/빈문자열 → 400
  if (!username || !password) {
    return new Response(JSON.stringify({ error: 'username and password are required' }), {
      status: 400,
    });
  }

  // DB에서 username으로 사용자 조회
  const user = await prisma.user.findUnique({ where: { username } });

  // 사용자 없으면 → 401
  if (!user) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
    });
  }

  // 비밀번호 검증
  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);

  // 비밀번호 불일치 → 401
  if (!isPasswordValid) {
    return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
    });
  }

  // JWT 발급
  const token = await signToken({ userId: user.id, username: user.username });

  return new Response(
    JSON.stringify({ token, userId: user.id, username: user.username }),
    { status: 200 }
  );
}
