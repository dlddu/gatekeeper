'use client';

import { useCallback, useEffect, useState } from 'react';
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
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPendingRequests = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setIsRefreshing(true);
      }
      setError(null);

      const response = await fetch('/api/me/requests/pending');

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
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1
          className="text-lg font-semibold text-gray-900"
          style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}
        >
          대기 목록
        </h1>
        <button
          onClick={() => fetchPendingRequests(true)}
          disabled={isRefreshing}
          aria-label="새로고침"
          className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          style={{
            background: 'none',
            border: 'none',
            cursor: isRefreshing ? 'default' : 'pointer',
            padding: '0.25rem',
            color: '#6b7280',
            opacity: isRefreshing ? 0.5 : 1,
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              animation: isRefreshing ? 'spin 1s linear infinite' : 'none',
            }}
          >
            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
          </svg>
        </button>
      </header>
      <main
        className="px-4 py-4"
        style={{ paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '1rem', paddingBottom: '1rem' }}
      >
        {isLoading ? (
          <div
            className="flex items-center justify-center py-16"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '4rem', paddingBottom: '4rem' }}
          >
            <p className="text-gray-400" style={{ color: '#9ca3af' }}>로딩 중...</p>
          </div>
        ) : error ? (
          <div
            className="flex items-center justify-center py-16"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', paddingTop: '4rem', paddingBottom: '4rem' }}
          >
            <p className="text-red-500" style={{ color: '#ef4444' }}>{error}</p>
          </div>
        ) : (
          <RequestCardList requests={requests} />
        )}
      </main>
      <BottomNav />
    </div>
  );
}
