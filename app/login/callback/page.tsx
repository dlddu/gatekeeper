'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LoginCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const error = searchParams.get('error');
  const isError = !token || !!error;

  useEffect(() => {
    if (token && !error) {
      localStorage.setItem('token', token);
      router.push('/requests');
    }
  }, [router, token, error]);

  if (!isError) {
    return (
      <div
        className="min-h-screen bg-gray-50 flex items-center justify-center"
        style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div
          className="text-center"
          style={{ textAlign: 'center' }}
        >
          <svg
            aria-hidden="true"
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6366f1"
            strokeWidth="2"
            style={{ animation: 'spin 1s linear infinite', display: 'inline-block', marginBottom: '1rem' }}
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
          <p
            className="text-gray-500 text-sm"
            style={{ color: '#6b7280', fontSize: '0.875rem' }}
          >
            로그인 처리 중...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-50 flex items-center justify-center"
      style={{ minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        className="bg-white rounded-2xl shadow-sm px-8 py-10 w-full max-w-sm text-center"
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
          textAlign: 'center',
        }}
      >
        <div
          role="alert"
          className="mb-6"
          style={{ marginBottom: '1.5rem' }}
        >
          <p
            className="text-red-600 font-medium mb-2"
            style={{ color: '#dc2626', fontWeight: 500, marginBottom: '0.5rem' }}
          >
            인증 처리에 실패했습니다.
          </p>
          <p
            className="text-gray-500 text-sm"
            style={{ color: '#6b7280', fontSize: '0.875rem' }}
          >
            인증 과정에서 오류가 발생했습니다.
          </p>
        </div>

        <a
          href="/login"
          className="inline-block px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700"
          style={{
            display: 'inline-block',
            paddingLeft: '1.5rem',
            paddingRight: '1.5rem',
            paddingTop: '0.5rem',
            paddingBottom: '0.5rem',
            backgroundColor: '#4f46e5',
            color: '#ffffff',
            fontSize: '0.875rem',
            fontWeight: 500,
            borderRadius: '0.5rem',
            textDecoration: 'none',
          }}
        >
          로그인 페이지로 돌아가기
        </a>
      </div>
    </div>
  );
}

export default function LoginCallbackPage() {
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
      <LoginCallbackContent />
    </Suspense>
  );
}
