'use client';

import RequestCard from './RequestCard';

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

interface RequestCardListProps {
  requests: Request[];
}

export default function RequestCardList({ requests }: RequestCardListProps) {
  if (requests.length === 0) {
    return (
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
        <p>대기 중인 요청이 없습니다</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3"
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
    >
      {requests.map((request) => (
        <RequestCard key={request.id} request={request} />
      ))}
    </div>
  );
}
