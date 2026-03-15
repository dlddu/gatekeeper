'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import BottomNav from '@/components/BottomNav';

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '';

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
  const router = useRouter();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnsupported, setIsUnsupported] = useState(false);
  const [isDenied, setIsDenied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    async function initPushState() {
      try {
        // Push API 지원 여부 확인
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

        // 알림 권한 확인
        if (Notification.permission === 'denied') {
          setIsDenied(true);
          setIsLoading(false);
          return;
        }

        // 기존 구독 여부 확인
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          const subscription = await registration.pushManager.getSubscription();
          if (subscription) {
            setIsSubscribed(true);
          }
        }
      } catch {
        // 초기화 실패 시 기본 상태 유지
      } finally {
        setIsLoading(false);
      }
    }

    initPushState();
  }, [router]);

  async function handleToggle() {
    if (isLoading || isUnsupported || isDenied) return;

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    setIsLoading(true);
    try {
      if (!isSubscribed) {
        // 토글 ON: 구독 흐름
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

        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        const response = await fetch('/api/me/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(subscription),
        });

        if (response.status === 401) {
          localStorage.removeItem('token');
          router.push('/login');
          return;
        }

        if (response.ok) {
          setIsSubscribed(true);
        }
      } else {
        // 토글 OFF: 구독 해제 흐름
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
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });

        if (response.status === 401) {
          localStorage.removeItem('token');
          router.push('/login');
          return;
        }

        if (response.ok) {
          setIsSubscribed(false);
        }
      }
    } catch {
      // 에러 발생 시 상태 유지
    } finally {
      setIsLoading(false);
    }
  }

  function renderStatusMessage() {
    if (isUnsupported) {
      return (
        <p
          className="text-sm text-gray-500 mt-2"
          style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}
        >
          이 브라우저는 Push 알림을 지원하지 않습니다
        </p>
      );
    }
    if (isDenied) {
      return (
        <p
          className="text-sm text-red-500 mt-2"
          style={{ fontSize: '0.875rem', color: '#ef4444', marginTop: '0.5rem' }}
        >
          브라우저에서 알림 권한이 차단되었습니다
        </p>
      );
    }
    if (isSubscribed) {
      return (
        <p
          className="text-sm text-green-600 mt-2"
          style={{ fontSize: '0.875rem', color: '#16a34a', marginTop: '0.5rem' }}
        >
          알림이 활성화되어 있습니다
        </p>
      );
    }
    return (
      <p
        className="text-sm text-gray-500 mt-2"
        style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}
      >
        Push 알림을 활성화하면 승인 요청 알림을 받을 수 있습니다
      </p>
    );
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
          설정
        </h1>
      </header>

      <main
        className="px-4 py-4"
        style={{
          paddingLeft: '1rem',
          paddingRight: '1rem',
          paddingTop: '1rem',
          paddingBottom: '1rem',
        }}
      >
        <div
          className="bg-white rounded-lg border border-gray-200 p-4"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '0.5rem',
            border: '1px solid #e5e7eb',
            padding: '1rem',
          }}
        >
          <div
            className="flex items-center justify-between"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <div>
              <p
                className="text-sm font-medium text-gray-900"
                style={{ fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}
              >
                Push 알림
              </p>
            </div>

            <button
              role="switch"
              aria-checked={isSubscribed}
              aria-label="Push 알림"
              disabled={isUnsupported || isDenied || isLoading}
              onClick={handleToggle}
              className={`relative inline-flex w-11 h-6 rounded-full transition-colors focus:outline-none ${
                isSubscribed ? 'bg-green-500' : 'bg-gray-200'
              } ${isUnsupported || isDenied || isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              style={{
                position: 'relative',
                display: 'inline-flex',
                width: '2.75rem',
                height: '1.5rem',
                borderRadius: '9999px',
                backgroundColor: isSubscribed ? '#22c55e' : '#e5e7eb',
                border: 'none',
                cursor: isUnsupported || isDenied || isLoading ? 'not-allowed' : 'pointer',
                opacity: isUnsupported || isDenied || isLoading ? 0.5 : 1,
                transition: 'background-color 0.2s',
                outline: 'none',
                flexShrink: 0,
              }}
            >
              <span
                className={`inline-block w-5 h-5 bg-white rounded-full shadow transform transition-transform ${
                  isSubscribed ? 'translate-x-5' : 'translate-x-0.5'
                }`}
                style={{
                  display: 'inline-block',
                  width: '1.25rem',
                  height: '1.25rem',
                  backgroundColor: '#ffffff',
                  borderRadius: '9999px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                  transform: isSubscribed ? 'translateX(1.25rem)' : 'translateX(0.125rem)',
                  transition: 'transform 0.2s',
                  alignSelf: 'center',
                }}
              />
            </button>
          </div>

          {renderStatusMessage()}
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
