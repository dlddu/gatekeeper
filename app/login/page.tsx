'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);

  const errorParam = searchParams.get('error');

  // 이미 인증된 경우 /requests로 리다이렉트
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/requests');
    }
  }, [router]);

  function handleLogin() {
    setIsLoading(true);
    window.location.href = '/api/auth/oidc/authorize';
  }

  return (
    <div
      className="min-h-screen bg-gray-50 flex items-center justify-center"
      style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-md p-8 w-full max-w-sm"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
          padding: '2rem',
          width: '100%',
          maxWidth: '24rem',
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: '0.25rem' }}
          >
            Gatekeeper
          </h1>
          <p
            className="text-sm text-gray-500"
            style={{ fontSize: '0.875rem', color: '#6b7280' }}
          >
            승인 게이트웨이 서비스
          </p>
        </div>

        {errorParam && (
          <div
            className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4"
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
            }}
            role="alert"
          >
            <p
              className="text-sm text-red-600"
              style={{ fontSize: '0.875rem', color: '#dc2626' }}
            >
              로그인에 실패했습니다. 다시 시도해 주세요.
            </p>
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full bg-gray-900 text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2"
          style={{
            width: '100%',
            backgroundColor: isLoading ? '#4b5563' : '#111827',
            color: '#ffffff',
            borderRadius: '0.75rem',
            padding: '0.75rem 1rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            border: 'none',
            cursor: isLoading ? 'not-allowed' : 'pointer',
          }}
        >
          {isLoading ? (
            <>
              <svg
                aria-hidden="true"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="animate-spin"
                style={{ animation: 'spin 1s linear infinite' }}
              >
                <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              로그인 중...
            </>
          ) : (
            '로그인'
          )}
        </button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
