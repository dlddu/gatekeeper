'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCountdown } from '@/hooks/useCountdown';

interface RequestDetail {
  id: string;
  externalId: string;
  context: string;
  requesterName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  timeoutSeconds: number | null;
  expiresAt: string | null;
  createdAt: string;
  processedAt: string | null;
  processedById: string | null;
}

export default function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingAction, setPendingAction] = useState<'approve' | 'reject' | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [requestId, setRequestId] = useState<string>('');

  const [minutes, seconds] = useCountdown(request?.expiresAt ?? null);

  useEffect(() => {
    params.then(({ id }) => setRequestId(id));
  }, [params]);

  useEffect(() => {
    if (!requestId) return;

    async function fetchRequest() {
      try {
        const response = await fetch(`/api/me/requests/${requestId}`);

        if (!response.ok) {
          setError('요청 정보를 불러오는데 실패했습니다');
          return;
        }

        const data = await response.json();
        setRequest(data);
      } catch {
        setError('요청 정보를 불러오는데 실패했습니다');
      } finally {
        setIsLoading(false);
      }
    }

    fetchRequest();
  }, [requestId]);

  function handleBack() {
    router.push('/requests');
  }

  function handleApproveClick() {
    setPendingAction('approve');
    setShowConfirmDialog(true);
  }

  function handleRejectClick() {
    setPendingAction('reject');
    setShowConfirmDialog(true);
  }

  function handleCancelDialog() {
    setShowConfirmDialog(false);
    setPendingAction(null);
  }

  async function handleConfirmAction() {
    if (!pendingAction || !request) return;

    setIsSubmitting(true);

    try {
      const endpoint =
        pendingAction === 'approve'
          ? `/api/requests/${request.id}/approve`
          : `/api/requests/${request.id}/reject`;

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        setError('처리에 실패했습니다');
        setShowConfirmDialog(false);
        setPendingAction(null);
        return;
      }

      router.push('/requests');
    } catch {
      setError('처리에 실패했습니다');
    } finally {
      setIsSubmitting(false);
      setShowConfirmDialog(false);
      setPendingAction(null);
    }
  }

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

  if (!request) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <p className="text-gray-400" style={{ color: '#9ca3af' }}>요청을 찾을 수 없습니다</p>
      </div>
    );
  }

  const isDisabled = request.status !== 'PENDING';
  const isExpired = request.status === 'EXPIRED';

  const pad = (n: number) => String(n).padStart(2, '0');

  function renderTimerSection() {
    if (request!.status === 'APPROVED' || request!.status === 'REJECTED') {
      return null;
    }

    if (isExpired) {
      return (
        <div
          className="bg-gray-100 rounded-lg p-4 mb-4 flex items-center justify-center"
          style={{
            backgroundColor: '#f3f4f6',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            className="text-gray-500 font-medium text-lg"
            style={{ color: '#6b7280', fontWeight: 500, fontSize: '1.125rem' }}
          >
            만료됨
          </span>
        </div>
      );
    }

    if (request!.expiresAt) {
      return (
        <div
          className="bg-amber-50 rounded-lg p-4 mb-4 flex items-center justify-center"
          style={{
            backgroundColor: '#fffbeb',
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            className="text-amber-600 font-mono font-semibold text-2xl"
            style={{ color: '#d97706', fontFamily: 'monospace', fontWeight: 600, fontSize: '1.5rem' }}
          >
            {pad(minutes)}:{pad(seconds)}
          </span>
        </div>
      );
    }

    return (
      <div
        className="bg-gray-100 rounded-lg p-4 mb-4 flex items-center justify-center"
        style={{
          backgroundColor: '#f3f4f6',
          borderRadius: '0.5rem',
          padding: '1rem',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          className="text-gray-500 font-medium"
          style={{ color: '#6b7280', fontWeight: 500 }}
        >
          제한 없음
        </span>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-gray-50"
      style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}
    >
      {/* Header */}
      <header
        className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3"
        style={{
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #e5e7eb',
          paddingLeft: '1rem',
          paddingRight: '1rem',
          paddingTop: '0.75rem',
          paddingBottom: '0.75rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
        }}
      >
        <button
          onClick={handleBack}
          className="text-gray-500 hover:text-gray-700 text-sm font-medium"
          style={{ color: '#6b7280', fontSize: '0.875rem', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
        >
          뒤로가기
        </button>
        <h1
          className="text-lg font-semibold text-gray-900"
          style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}
        >
          요청 상세
        </h1>
      </header>

      <main
        className="px-4 py-4"
        style={{ paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '1rem', paddingBottom: '1rem' }}
      >
        {/* Timer Section */}
        {renderTimerSection()}

        {/* Info Card */}
        <div
          className="bg-white rounded-lg border border-gray-200 p-4 mb-4"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '0.5rem',
            border: '1px solid #e5e7eb',
            padding: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div className="mb-3" style={{ marginBottom: '0.75rem' }}>
            <span
              className="text-xs text-gray-400 uppercase tracking-wide"
              style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              요청 ID
            </span>
            <p
              className="text-sm font-mono text-gray-700 mt-1"
              style={{ fontSize: '0.875rem', fontFamily: 'monospace', color: '#374151', marginTop: '0.25rem' }}
            >
              {request.id}
            </p>
          </div>

          <div className="mb-3" style={{ marginBottom: '0.75rem' }}>
            <span
              className="text-xs text-gray-400 uppercase tracking-wide"
              style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              요청자
            </span>
            <p
              className="text-sm text-gray-900 mt-1 font-medium"
              style={{ fontSize: '0.875rem', color: '#111827', marginTop: '0.25rem', fontWeight: 500 }}
            >
              {request.requesterName}
            </p>
          </div>

          <div className="mb-3" style={{ marginBottom: '0.75rem' }}>
            <span
              className="text-xs text-gray-400 uppercase tracking-wide"
              style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              맥락
            </span>
            <p
              className="text-sm text-gray-700 mt-1"
              style={{ fontSize: '0.875rem', color: '#374151', marginTop: '0.25rem' }}
            >
              {request.context}
            </p>
          </div>

          <div>
            <span
              className="text-xs text-gray-400 uppercase tracking-wide"
              style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              생성일시
            </span>
            <p
              className="text-sm text-gray-700 mt-1"
              style={{ fontSize: '0.875rem', color: '#374151', marginTop: '0.25rem' }}
            >
              {new Date(request.createdAt).toLocaleString('ko-KR')}
            </p>
          </div>

          {request.processedAt && (
            <div className="mt-3" style={{ marginTop: '0.75rem' }}>
              <span
                className="text-xs text-gray-400 uppercase tracking-wide"
                style={{ fontSize: '0.75rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}
              >
                처리일시
              </span>
              <p
                className="text-sm text-gray-700 mt-1"
                style={{ fontSize: '0.875rem', color: '#374151', marginTop: '0.25rem' }}
              >
                {new Date(request.processedAt).toLocaleString('ko-KR')}
              </p>
            </div>
          )}
        </div>

        {/* Status Badge */}
        <div
          className="mb-4"
          style={{ marginBottom: '1rem' }}
        >
          {request.status === 'APPROVED' && (
            <span
              className="inline-block bg-emerald-100 text-emerald-700 text-sm font-medium px-3 py-1 rounded-full"
              style={{ backgroundColor: '#d1fae5', color: '#065f46', fontSize: '0.875rem', fontWeight: 500, padding: '0.25rem 0.75rem', borderRadius: '9999px' }}
            >
              승인됨
            </span>
          )}
          {request.status === 'REJECTED' && (
            <span
              className="inline-block bg-red-100 text-red-700 text-sm font-medium px-3 py-1 rounded-full"
              style={{ backgroundColor: '#fee2e2', color: '#b91c1c', fontSize: '0.875rem', fontWeight: 500, padding: '0.25rem 0.75rem', borderRadius: '9999px' }}
            >
              거절됨
            </span>
          )}
        </div>

        {/* Expired notice */}
        {isExpired && (
          <p
            className="text-sm text-gray-500 mb-4"
            style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' }}
          >
            이 요청은 만료되었습니다
          </p>
        )}

        {/* Action Buttons */}
        <div
          className="flex gap-3"
          style={{ display: 'flex', gap: '0.75rem' }}
        >
          <button
            onClick={handleRejectClick}
            disabled={isDisabled || isSubmitting}
            className="flex-1 py-3 border border-red-300 text-red-600 rounded-lg font-medium hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              flex: 1,
              paddingTop: '0.75rem',
              paddingBottom: '0.75rem',
              border: '1px solid #fca5a5',
              color: '#dc2626',
              borderRadius: '0.5rem',
              fontWeight: 500,
              backgroundColor: 'transparent',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
            }}
          >
            거절
          </button>
          <button
            onClick={handleApproveClick}
            disabled={isDisabled || isSubmitting}
            className="flex-1 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              flex: 1,
              paddingTop: '0.75rem',
              paddingBottom: '0.75rem',
              backgroundColor: isDisabled ? '#6b7280' : '#059669',
              color: '#ffffff',
              borderRadius: '0.5rem',
              fontWeight: 500,
              border: 'none',
              cursor: isDisabled ? 'not-allowed' : 'pointer',
              opacity: isDisabled ? 0.5 : 1,
            }}
          >
            승인
          </button>
        </div>
      </main>

      {/* Confirm Dialog (modal) */}
      {showConfirmDialog && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 50,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
          }}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-6 mx-4 w-full max-w-sm"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '0.75rem',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
              padding: '1.5rem',
              margin: '0 1rem',
              width: '100%',
              maxWidth: '24rem',
            }}
          >
            <h2
              className="text-base font-semibold text-gray-900 mb-2"
              style={{ fontSize: '1rem', fontWeight: 600, color: '#111827', marginBottom: '0.5rem' }}
            >
              {pendingAction === 'approve' ? '승인하시겠습니까?' : '거절하시겠습니까?'}
            </h2>
            <p
              className="text-sm text-gray-500 mb-6"
              style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' }}
            >
              이 작업은 되돌릴 수 없습니다.
            </p>
            <div
              className="flex gap-3"
              style={{ display: 'flex', gap: '0.75rem' }}
            >
              <button
                onClick={handleCancelDialog}
                disabled={isSubmitting}
                className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50"
                style={{
                  flex: 1,
                  paddingTop: '0.5rem',
                  paddingBottom: '0.5rem',
                  border: '1px solid #d1d5db',
                  color: '#374151',
                  borderRadius: '0.5rem',
                  fontWeight: 500,
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={isSubmitting}
                className="flex-1 py-2 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-700 disabled:opacity-50"
                style={{
                  flex: 1,
                  paddingTop: '0.5rem',
                  paddingBottom: '0.5rem',
                  backgroundColor: '#111827',
                  color: '#ffffff',
                  borderRadius: '0.5rem',
                  fontWeight: 500,
                  border: 'none',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  opacity: isSubmitting ? 0.5 : 1,
                }}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
