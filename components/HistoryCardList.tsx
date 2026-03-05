'use client';

import HistoryCard from './HistoryCard';

interface HistoryItem {
  id: string;
  externalId: string;
  status: string;
  processedAt: string | null;
  context: string | null;
  requesterName: string | null;
  createdAt: string;
}

interface HistoryCardListProps {
  items: HistoryItem[];
}

export default function HistoryCardList({ items }: HistoryCardListProps) {
  if (items.length === 0) {
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
        <p>처리 이력이 없습니다</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-3"
      style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
    >
      {items.map((item) => (
        <HistoryCard key={item.id} item={item} />
      ))}
    </div>
  );
}
