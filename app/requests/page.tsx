'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import RequestCardList from '@/components/RequestCardList';
import BottomNav from '@/components/BottomNav';

interface Request {
  id: string;
  externalId: string;
  context: string | null;
  requesterName: string | null;
  status: string;
  timeoutSeconds: number | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function RequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    async function fetchPendingRequests() {
      const token = localStorage.getItem('token');
      try {
        const response = await fetch('/api/me/requests/pending', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.status === 401) {
          localStorage.removeItem('token');
          router.push('/login');
          return;
        }

        if (!response.ok) {
          setError('요청 목록을 불러오는데 실패했습니다');
          return;
        }

        const data = await response.json();
        setRequests(data.requests);
      } catch {
        setError('요청 목록을 불러오는데 실패했습니다');
      } finally {
        setIsLoading(false);
      }
    }

    fetchPendingRequests();
  }, [router]);

  if (isLoading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <p className="text-gray-400" style={{ color: '#9ca3af' }}>로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <p className="text-red-500" style={{ color: '#ef4444' }}>{error}</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-50 pb-16"
      style={{ minHeight: '100vh', backgroundColor: '#f9fafb', paddingBottom: '4rem' }}
    >
      <header
        className="bg-white border-b border-gray-200 px-4 py-3"
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          paddingLeft: '1rem',
          paddingRight: '1rem',
          paddingTop: '0.75rem',
          paddingBottom: '0.75rem',
        }}
      >
        <h1
          className="text-lg font-semibold text-gray-900"
          style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}
        >
          대기 목록
        </h1>
      </header>
      <main
        className="px-4 py-4"
        style={{ paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '1rem', paddingBottom: '1rem' }}
      >
        <RequestCardList requests={requests} />
      </main>
      <BottomNav />
    </div>
  );
}
