package push

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/dlddu/gatekeeper/backend/internal/models"
)

const TitleApprovalRequest = "승인 요청이 도착했습니다"

type Service struct {
	subject    string
	publicKey  string
	privateKey string
}

func NewService(subject, publicKey, privateKey string) *Service {
	return &Service{subject: subject, publicKey: publicKey, privateKey: privateKey}
}

func (s *Service) configured() error {
	if s.subject == "" || s.publicKey == "" || s.privateKey == "" {
		return fmt.Errorf("[Push] VAPID 환경변수가 설정되지 않았습니다. VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY를 확인하세요")
	}
	return nil
}

type SendOptions struct {
	Subscriptions []*models.PushSubscription
	Title         string
	Body          string
	// OnExpired is invoked for subscriptions returning HTTP 410.
	OnExpired func(ctx context.Context, endpoint string) error
	// OnSuccess is invoked once per successful delivery.
	OnSuccess func()
}

// Send delivers a notification to each subscription, mirroring the behavior of
// lib/push.ts: failures are logged and skipped, expirations trigger OnExpired.
func (s *Service) Send(ctx context.Context, opts SendOptions) error {
	if err := s.configured(); err != nil {
		return err
	}

	payload, err := json.Marshal(map[string]string{"title": opts.Title, "body": opts.Body})
	if err != nil {
		return fmt.Errorf("marshal push payload: %w", err)
	}

	log.Printf("[Push] 발송 시작: %d건, title=%q", len(opts.Subscriptions), opts.Title)

	successCount, failCount, expiredCount := 0, 0, 0
	for _, sub := range opts.Subscriptions {
		ws := &webpush.Subscription{
			Endpoint: sub.Endpoint,
			Keys: webpush.Keys{
				P256dh: sub.P256dh,
				Auth:   sub.Auth,
			},
		}
		resp, sendErr := webpush.SendNotificationWithContext(ctx, payload, ws, &webpush.Options{
			Subscriber:      s.subject,
			VAPIDPublicKey:  s.publicKey,
			VAPIDPrivateKey: s.privateKey,
			TTL:             30,
		})
		if sendErr != nil {
			failCount++
			log.Printf("[Push] 발송 실패: endpoint=%s, error=%v", sub.Endpoint, sendErr)
			continue
		}
		statusCode := resp.StatusCode
		// Drain and close the response body to allow connection reuse.
		_, _ = io.Copy(io.Discard, resp.Body)
		_ = resp.Body.Close()

		if statusCode == http.StatusGone { // 410: 구독 만료
			expiredCount++
			log.Printf("[Push] 구독 만료(410): endpoint=%s", sub.Endpoint)
			if opts.OnExpired != nil {
				if err := opts.OnExpired(ctx, sub.Endpoint); err != nil {
					log.Printf("[Push] 만료 후 처리 실패: endpoint=%s, error=%v", sub.Endpoint, err)
				}
			}
			continue
		}
		if statusCode >= 200 && statusCode < 300 {
			successCount++
			if opts.OnSuccess != nil {
				opts.OnSuccess()
			}
			continue
		}

		failCount++
		log.Printf("[Push] 발송 실패: endpoint=%s, statusCode=%d", sub.Endpoint, statusCode)
	}

	log.Printf("[Push] 발송 완료: 성공=%d, 실패=%d, 만료=%d", successCount, failCount, expiredCount)
	return nil
}
