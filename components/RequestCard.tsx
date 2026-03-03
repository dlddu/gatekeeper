'use client';

import { useRouter } from 'next/navigation';
import { useCountdown } from '@/hooks/useCountdown';

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

interface RequestCardProps {
  request: Request;
}

export default function RequestCard({ request }: RequestCardProps) {
  const router = useRouter();
  const [minutes, seconds] = useCountdown(request.expiresAt);

  function handleClick() {
    router.push(`/requests/${request.id}`);
  }

  return (
    <div
      data-request-id={request.id}
      onClick={handleClick}
      className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm cursor-pointer"
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '1rem',
        padding: '1rem',
        border: '1px solid #f3f4f6',
        boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
        cursor: 'pointer',
      }}
    >
      <div className="mb-2" style={{ marginBottom: '0.5rem' }}>
        {request.context && (
          <p className="text-gray-900 font-medium" style={{ color: '#111827', fontWeight: 500 }}>{request.context}</p>
        )}
        {request.requesterName && (
          <p className="text-gray-500 text-sm" style={{ color: '#6b7280', fontSize: '0.875rem' }}>{request.requesterName}</p>
        )}
      </div>
      <div className="mt-2" style={{ marginTop: '0.5rem' }}>
        {request.timeoutSeconds != null ? (
          <div
            className="flex items-center gap-1"
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span
              className="animate-pulse inline-block w-2 h-2 rounded-full bg-amber-500"
              style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#f59e0b',
                animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
              }}
            />
            <span
              className="text-amber-600 text-sm"
              style={{ color: '#d97706', fontSize: '0.875rem' }}
            >
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
        ) : (
          <span
            className="text-gray-400 text-sm"
            style={{ color: '#9ca3af', fontSize: '0.875rem' }}
          >
            제한 없음
          </span>
        )}
      </div>
    </div>
  );
}
