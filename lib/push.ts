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

export const PUSH_TITLE_APPROVAL_REQUEST = '승인 요청이 도착했습니다';

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
  onSuccess?: () => void;
}

/**
 * VAPID 설정을 적용하고 각 구독에 Push 알림을 발송합니다.
 * 발송 실패 시에도 나머지 구독에 계속 발송을 시도합니다.
 * 410 에러(구독 만료) 발생 시 onExpired 콜백을 호출합니다.
 */
export async function sendPushNotifications(options: SendPushOptions): Promise<void> {
  const { subscriptions, title, body, onExpired, onSuccess } = options;

  const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? '';
  const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
  const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';

  if (!VAPID_SUBJECT || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error(
      '[Push] VAPID 환경변수가 설정되지 않았습니다. VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY를 확인하세요.'
    );
  }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

  const payload = JSON.stringify({ title, body });

  console.log(`[Push] 발송 시작: ${subscriptions.length}건, title="${title}"`);

  let successCount = 0;
  let failCount = 0;
  let expiredCount = 0;

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
      successCount++;
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: unknown) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'statusCode' in error &&
        (error as { statusCode: number }).statusCode === 410
      ) {
        expiredCount++;
        console.warn(`[Push] 구독 만료(410): endpoint=${subscription.endpoint}`);
        if (onExpired) {
          await onExpired(subscription.endpoint);
        }
      } else {
        failCount++;
        const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
          ? (error as { statusCode: number }).statusCode
          : 'unknown';
        console.error(`[Push] 발송 실패: endpoint=${subscription.endpoint}, statusCode=${statusCode}, error=${error}`);
      }
      // 개별 발송 실패는 무시하고 계속 진행
    }
  }

  console.log(`[Push] 발송 완료: 성공=${successCount}, 실패=${failCount}, 만료=${expiredCount}`);
}
