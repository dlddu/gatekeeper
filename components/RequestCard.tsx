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
    >
      <div className="mb-2">
        {request.context && (
          <p className="text-gray-900 font-medium">{request.context}</p>
        )}
        {request.requesterName && (
          <p className="text-gray-500 text-sm">{request.requesterName}</p>
        )}
      </div>
      <div className="mt-2">
        {request.timeoutSeconds != null ? (
          <div className="flex items-center gap-1">
            <span className="animate-pulse inline-block w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-amber-600 text-sm">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">제한 없음</span>
        )}
      </div>
    </div>
  );
}
