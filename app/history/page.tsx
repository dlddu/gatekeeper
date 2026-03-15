'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import HistoryCardList from '@/components/HistoryCardList';
import BottomNav from '@/components/BottomNav';

interface HistoryItem {
  id: string;
  externalId: string;
  status: string;
  processedAt: string | null;
  context: string | null;
  requesterName: string | null;
  createdAt: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    async function fetchHistory() {
      const token = localStorage.getItem('token');
      try {
        const response = await fetch('/api/me/requests/history', {
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
          setError('이력을 불러올 수 없습니다');
          return;
        }

        const data = await response.json();
        setItems(data.items);
        setHasMore(data.hasMore);
        setNextCursor(data.nextCursor);
      } catch {
        setError('이력을 불러올 수 없습니다');
      } finally {
        setIsLoading(false);
      }
    }

    fetchHistory();
  }, [router]);

  async function handleLoadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);

    const token = localStorage.getItem('token');
    try {
      const url = `/api/me/requests/history?cursor=${encodeURIComponent(nextCursor)}`;
      const response = await fetch(url, {
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
        setError('이력을 불러올 수 없습니다');
        return;
      }

      const data = await response.json();
      setItems((prev) => [...prev, ...data.items]);
      setHasMore(data.hasMore);
      setNextCursor(data.nextCursor);
    } catch {
      setError('이력을 불러올 수 없습니다');
    } finally {
      setIsLoadingMore(false);
    }
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
          처리 이력
        </h1>
        <p
          className="text-sm text-gray-500 mt-1"
          style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}
        >
          최근 처리된 요청
        </p>
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
            className="flex items-center justify-center flex-col gap-4 py-16"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', paddingTop: '4rem', paddingBottom: '4rem' }}
          >
            <p className="text-red-500" style={{ color: '#ef4444' }}>이력을 불러올 수 없습니다</p>
            <button
              onClick={() => {
                setError(null);
                setIsLoading(true);
                const token = localStorage.getItem('token');
                if (!token) {
                  router.push('/login');
                  return;
                }
                fetch('/api/me/requests/history', {
                  headers: { Authorization: `Bearer ${token}` },
                })
                  .then(async (res) => {
                    if (res.status === 401) {
                      localStorage.removeItem('token');
                      router.push('/login');
                      return;
                    }
                    if (!res.ok) {
                      setError('이력을 불러올 수 없습니다');
                      return;
                    }
                    const data = await res.json();
                    setItems(data.items);
                    setHasMore(data.hasMore);
                    setNextCursor(data.nextCursor);
                  })
                  .catch(() => setError('이력을 불러올 수 없습니다'))
                  .finally(() => setIsLoading(false));
              }}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium"
              style={{
                paddingLeft: '1rem',
                paddingRight: '1rem',
                paddingTop: '0.5rem',
                paddingBottom: '0.5rem',
                backgroundColor: '#111827',
                color: '#ffffff',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 500,
                border: 'none',
                cursor: 'pointer',
              }}
            >
              재시도
            </button>
          </div>
        ) : items.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-16 text-gray-400"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: '4rem',
              paddingBottom: '4rem',
              color: '#9ca3af',
            }}
          >
            <p>처리 이력이 없습니다</p>
          </div>
        ) : (
          <>
            <HistoryCardList items={items} />
            {hasMore && (
              <div
                className="mt-4 flex justify-center"
                style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center' }}
              >
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="px-6 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                  style={{
                    paddingLeft: '1.5rem',
                    paddingRight: '1.5rem',
                    paddingTop: '0.5rem',
                    paddingBottom: '0.5rem',
                    backgroundColor: '#111827',
                    color: '#ffffff',
                    borderRadius: '0.5rem',
                    fontSize: '0.875rem',
                    fontWeight: 500,
                    border: 'none',
                    cursor: isLoadingMore ? 'not-allowed' : 'pointer',
                    opacity: isLoadingMore ? 0.5 : 1,
                  }}
                >
                  {isLoadingMore ? '불러오는 중...' : '더 보기'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <BottomNav />
    </div>
  );
}
