'use client';

interface StatusBadgeProps {
  status: 'APPROVED' | 'REJECTED' | 'EXPIRED' | string;
}

const statusConfig: Record<string, { className: string; style: React.CSSProperties; label: string }> = {
  APPROVED: {
    className: 'bg-emerald-100 text-emerald-700',
    style: { backgroundColor: '#d1fae5', color: '#065f46' },
    label: '승인',
  },
  REJECTED: {
    className: 'bg-red-100 text-red-700',
    style: { backgroundColor: '#fee2e2', color: '#b91c1c' },
    label: '거절',
  },
  EXPIRED: {
    className: 'bg-gray-200 text-gray-500',
    style: { backgroundColor: '#e5e7eb', color: '#6b7280' },
    label: '만료',
  },
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    className: 'bg-gray-100 text-gray-600',
    style: { backgroundColor: '#f3f4f6', color: '#4b5563' },
    label: status,
  };

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${config.className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        paddingLeft: '0.5rem',
        paddingRight: '0.5rem',
        paddingTop: '0.125rem',
        paddingBottom: '0.125rem',
        borderRadius: '9999px',
        fontSize: '0.75rem',
        fontWeight: 500,
        ...config.style,
      }}
    >
      {config.label}
    </span>
  );
}
