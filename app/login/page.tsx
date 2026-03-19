'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      router.push('/requests');
      return;
    }

    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError('로그인에 실패했습니다. 다시 시도해 주세요.');
    }
  }, [router, searchParams]);

  function handleLogin() {
    setIsLoading(true);
    window.location.href = '/api/auth/oidc/authorize';
  }

  return (
    <div
      className="min-h-screen bg-gray-50 flex items-center justify-center"
      style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        className="bg-white rounded-2xl shadow-sm px-8 py-10 w-full max-w-sm"
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '1rem',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          paddingLeft: '2rem',
          paddingRight: '2rem',
          paddingTop: '2.5rem',
          paddingBottom: '2.5rem',
          width: '100%',
          maxWidth: '24rem',
        }}
      >
        <div
          className="text-center mb-8"
          style={{ textAlign: 'center', marginBottom: '2rem' }}
        >
          <h1
            className="text-2xl font-bold text-gray-900"
            style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', marginBottom: '0.5rem' }}
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

        {error && (
          <div
            role="alert"
            className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600"
            style={{
              marginBottom: '1rem',
              paddingLeft: '1rem',
              paddingRight: '1rem',
              paddingTop: '0.75rem',
              paddingBottom: '0.75rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              fontSize: '0.875rem',
              color: '#dc2626',
            }}
          >
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full py-3 px-4 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          style={{
            width: '100%',
            paddingTop: '0.75rem',
            paddingBottom: '0.75rem',
            paddingLeft: '1rem',
            paddingRight: '1rem',
            backgroundColor: isLoading ? '#6366f1' : '#4f46e5',
            color: '#ffffff',
            fontWeight: 500,
            borderRadius: '0.75rem',
            border: 'none',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            opacity: isLoading ? 0.7 : 1,
          }}
        >
          {isLoading ? (
            <>
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
    <Suspense
      fallback={
        <div
          className="min-h-screen bg-gray-50 flex items-center justify-center"
          style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <p className="text-gray-400" style={{ color: '#9ca3af' }}>로딩 중...</p>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
