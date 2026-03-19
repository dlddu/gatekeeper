'use client';

import { useEffect, useState } from 'react';
import BottomNav from '@/components/BottomNav';

const NEXT_PUBLIC_VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export default function SettingsPage() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnsupported, setIsUnsupported] = useState(false);
  const [isDenied, setIsDenied] = useState(false);

  useEffect(() => {
    async function initPushState() {
      try {
        if (
          typeof window === 'undefined' ||
          !('Notification' in window) ||
          !('PushManager' in window) ||
          !('serviceWorker' in navigator)
        ) {
          setIsUnsupported(true);
          setIsLoading(false);
          return;
        }

        if (Notification.permission === 'denied') {
          setIsDenied(true);
          setIsLoading(false);
          return;
        }

        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            setIsSubscribed(true);
          }
        }
      } catch {
        // 기본 상태 유지
      } finally {
        setIsLoading(false);
      }
    }

    initPushState();
  }, []);

  async function handleToggle() {
    if (isLoading || isUnsupported || isDenied) return;

    setIsLoading(true);
    try {
      if (!isSubscribed) {
        // 구독 흐름
        const permission = await Notification.requestPermission();
        if (permission === 'denied') {
          setIsDenied(true);
          setIsLoading(false);
          return;
        }
        if (permission !== 'granted') {
          setIsLoading(false);
          return;
        }

        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          setIsLoading(false);
          return;
        }

        const applicationServerKey = urlBase64ToUint8Array(NEXT_PUBLIC_VAPID_PUBLIC_KEY);
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        const response = await fetch('/api/me/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(subscription),
        });

        if (response.ok) {
          setIsSubscribed(true);
        }
      } else {
        // 구독 해제 흐름
        const registration = await navigator.serviceWorker.getRegistration();
        if (!registration) {
          setIsLoading(false);
          return;
        }

        const subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          setIsSubscribed(false);
          setIsLoading(false);
          return;
        }

        await subscription.unsubscribe();

        const response = await fetch('/api/me/push/unsubscribe', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        if (response.ok) {
          setIsSubscribed(false);
        }
      }
    } catch {
      // 에러 시 상태 유지
    } finally {
      setIsLoading(false);
    }
  }

  function getStatusMessage(): string {
    if (isUnsupported) return '이 브라우저는 Push 알림을 지원하지 않습니다';
    if (isDenied) return '브라우저에서 알림 권한이 차단되었습니다';
    if (isSubscribed) return '알림이 활성화되어 있습니다';
    return 'Push 알림을 활성화하면 승인 요청 알림을 받을 수 있습니다';
  }

  const isDisabled = isLoading || isUnsupported || isDenied;

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
          설정
        </h1>
      </header>
      <main
        className="px-4 py-4"
        style={{ paddingLeft: '1rem', paddingRight: '1rem', paddingTop: '1rem', paddingBottom: '1rem' }}
      >
        <div
          className="bg-white rounded-xl border border-gray-200 p-4"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '0.75rem',
            border: '1px solid #e5e7eb',
            padding: '1rem',
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div style={{ flex: 1 }}>
              <p
                className="text-sm font-medium text-gray-900"
                style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}
              >
                Push 알림
              </p>
              <p
                className="text-xs text-gray-500 mt-1"
                style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}
              >
                {getStatusMessage()}
              </p>
            </div>
            <button
              role="switch"
              aria-checked={isSubscribed}
              aria-label="Push 알림"
              onClick={handleToggle}
              disabled={isDisabled}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                isSubscribed ? 'bg-green-500' : 'bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              style={{
                position: 'relative',
                width: '2.75rem',
                height: '1.5rem',
                borderRadius: '9999px',
                backgroundColor: isSubscribed ? '#22c55e' : '#e5e7eb',
                border: 'none',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.5 : 1,
                transition: 'background-color 0.2s',
                flexShrink: 0,
                marginLeft: '1rem',
              }}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
                  isSubscribed ? 'translate-x-5' : 'translate-x-0'
                }`}
                style={{
                  position: 'absolute',
                  top: '0.125rem',
                  left: '0.125rem',
                  width: '1.25rem',
                  height: '1.25rem',
                  backgroundColor: '#ffffff',
                  borderRadius: '9999px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transform: isSubscribed ? 'translateX(1.25rem)' : 'translateX(0)',
                  transition: 'transform 0.2s',
                }}
              />
            </button>
          </div>
          {isLoading && (
            <p
              className="text-xs text-gray-400 mt-2"
              style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.5rem' }}
            >
              로딩 중...
            </p>
          )}
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
