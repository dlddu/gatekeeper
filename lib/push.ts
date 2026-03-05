/**
 * Push Notification 공유 유틸리티
 *
 * web-push를 사용하여 사용자에게 Push 알림을 발송합니다.
 * app/api/push/send/route.ts와 app/api/requests/route.ts 양쪽에서 사용합니다.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const webpush = require('web-push') as {
  setVapidDetails: (subject: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload: string
  ) => Promise<unknown>;
};

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SendPushOptions {
  subscriptions: PushSubscriptionRecord[];
  title: string;
  body: string;
  onExpired?: (endpoint: string) => Promise<void>;
}

/**
 * VAPID 설정을 적용하고 각 구독에 Push 알림을 발송합니다.
 * 발송 실패 시에도 나머지 구독에 계속 발송을 시도합니다.
 * 410 에러(구독 만료) 발생 시 onExpired 콜백을 호출합니다.
 */
export async function sendPushNotifications(options: SendPushOptions): Promise<void> {
  const { subscriptions, title, body, onExpired } = options;

  const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? '';
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const payload = JSON.stringify({ title, body });

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.p256dh,
            auth: subscription.auth,
          },
        },
        payload
      );
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        (error as { statusCode: number }).statusCode === 410
      ) {
        if (onExpired) {
          await onExpired(subscription.endpoint);
        }
      }
      // 개별 발송 실패는 무시하고 계속 진행
    }
  }
}
