'use client';

import StatusBadge from './StatusBadge';

interface HistoryItem {
  id: string;
  externalId: string;
  status: string;
  processedAt: string | null;
  context: string | null;
  requesterName: string | null;
  createdAt: string;
}

interface HistoryCardProps {
  item: HistoryItem;
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}`;
}

export default function HistoryCard({ item }: HistoryCardProps) {
  return (
    <div
      data-request-id={item.id}
      className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm"
      style={{
        backgroundColor: '#ffffff',
        borderRadius: '1rem',
        padding: '1rem',
        border: '1px solid #f3f4f6',
        boxShadow: '0 1px 2px 0 rgba(0,0,0,0.05)',
      }}
    >
      <div
        className="flex items-center justify-between mb-2"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}
      >
        <span
          className="font-mono text-sm text-gray-700"
          style={{ fontFamily: 'monospace', fontSize: '0.875rem', color: '#374151' }}
        >
          {item.externalId}
        </span>
        <StatusBadge status={item.status} />
      </div>
      {item.context && (
        <p
          className="text-gray-900 text-sm mb-1"
          style={{ color: '#111827', fontSize: '0.875rem', marginBottom: '0.25rem' }}
        >
          {item.context}
        </p>
      )}
      {item.requesterName && (
        <p
          className="text-gray-500 text-sm"
          style={{ color: '#6b7280', fontSize: '0.875rem' }}
        >
          {item.requesterName}
        </p>
      )}
      <div
        className="mt-2"
        style={{ marginTop: '0.5rem' }}
      >
        <span
          className="text-gray-400 text-xs"
          style={{ color: '#9ca3af', fontSize: '0.75rem' }}
        >
          {formatDateTime(item.processedAt)}
        </span>
      </div>
    </div>
  );
}
