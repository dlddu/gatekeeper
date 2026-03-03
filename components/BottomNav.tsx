'use client';

import { usePathname, useRouter } from 'next/navigation';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();

  const tabs = [
    { label: '대기', href: '/requests' },
    { label: '이력', href: '/history' },
    { label: '설정', href: '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || (tab.href === '/requests' && pathname?.startsWith('/requests'));
        return (
          <button
            key={tab.href}
            onClick={() => router.push(tab.href)}
            className={`flex-1 py-3 text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}
          >
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}
