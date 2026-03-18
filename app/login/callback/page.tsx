'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LoginCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error || !token || token.length === 0) {
      setIsError(true);
      return;
    }

    localStorage.setItem('token', token);
    router.push('/requests');
  }, [router, searchParams]);

  if (isError) {
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
              style={{ fontSize: '0.875rem', color: '#dc2626', marginBottom: '0.75rem' }}
            >
              인증 처리에 실패했습니다.
            </p>
            <a
              href="/login"
              className="text-sm text-blue-600 underline"
              style={{ fontSize: '0.875rem', color: '#2563eb', textDecoration: 'underline' }}
            >
              로그인 페이지로 돌아가기
            </a>
          </div>
        </div>
      </div>
    );
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
          textAlign: 'center',
        }}
      >
        <div
          className="flex items-center justify-center gap-3"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
        >
          <svg
            aria-hidden="true"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="animate-spin"
            style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}
          >
            <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
            <path d="M12 2a10 10 0 0 1 10 10" />
          </svg>
          <p
            className="text-gray-600"
            style={{ color: '#4b5563', fontSize: '1rem' }}
          >
            로그인 처리 중...
          </p>
        </div>
      </div>
    </div>
  );
}
