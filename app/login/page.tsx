'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 이미 인증된 경우 /requests로 리다이렉트
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/requests');
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.token);
        router.push('/requests');
        return; // 성공 시 isLoading 해제하지 않음 (페이지 이동 중 버튼이 disabled 유지)
      } else {
        setError('아이디 또는 비밀번호가 올바르지 않습니다');
      }
    } catch {
      setError('아이디 또는 비밀번호가 올바르지 않습니다');
    }
    setIsLoading(false);
  }

  return (
    <div>
      <h1>Gatekeeper</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="username">아이디</label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </div>
        <div>
          <label htmlFor="password">비밀번호</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>
        {error && <p role="alert">{error}</p>}
        <button type="submit" name="로그인" aria-label="로그인" disabled={isLoading}>
          {isLoading ? (
            <span aria-label="로딩 중">
              <svg
                aria-hidden="true"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            </span>
          ) : (
            '로그인'
          )}
        </button>
      </form>
    </div>
  );
}
