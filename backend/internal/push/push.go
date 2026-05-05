package push

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"

	webpush "github.com/SherClockHolmes/webpush-go"
	"github.com/dlddu/gatekeeper/backend/internal/models"
)

const TitleApprovalRequest = "승인 요청이 도착했습니다"

type Service struct {
	subject    string
	publicKey  string
	privateKey string
}

// NewService normalizes VAPID values so they match the format push services
// expect, hiding differences between web-push (Node) and webpush-go.
//
//   - subject: web-push silently accepted bare emails, webpush-go does not.
//     A value like "admin@example.com" gets a "mailto:" prefix.
//   - keys: VAPID spec mandates base64url-no-pad. web-push converted any
//     base64 input internally; webpush-go passes the string through into
//     the `k=` Authorization parameter, so a value with `+`, `/`, or `=`
//     causes Mozilla autopush to reject the JWT with `BadJwtToken`.
func NewService(subject, publicKey, privateKey string) *Service {
	return &Service{
		subject:    normalizeSubject(subject),
		publicKey:  normalizeBase64URL(publicKey),
		privateKey: normalizeBase64URL(privateKey),
	}
}

// normalizeSubject prepares VAPID_SUBJECT for SherClockHolmes/webpush-go.
//
// webpush-go internally prepends "mailto:" to any subscriber that doesn't
// start with "https:" — so passing an already-prefixed value like
// "mailto:admin@example.com" results in the doubly-prefixed JWT claim
// `sub: "mailto:mailto:admin@example.com"`, which Mozilla autopush rejects
// with `BadJwtToken` (403).
//
// Strip a leading "mailto:" so webpush-go can add exactly one back; pass
// http(s) URLs through unchanged.
func normalizeSubject(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return s
	}
	lower := strings.ToLower(s)
	if strings.HasPrefix(lower, "https://") || strings.HasPrefix(lower, "http://") {
		return s
	}
	if strings.HasPrefix(lower, "mailto:") {
		return s[len("mailto:"):]
	}
	return s
}

// normalizeBase64URL re-encodes any standard / URL-safe / padded variant of
// base64 into RawURLEncoding (URL-safe, no padding) — the form VAPID requires.
func normalizeBase64URL(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return s
	}
	for _, dec := range []*base64.Encoding{
		base64.RawURLEncoding,
		base64.URLEncoding,
		base64.RawStdEncoding,
		base64.StdEncoding,
	} {
		if raw, err := dec.DecodeString(s); err == nil {
			return base64.RawURLEncoding.EncodeToString(raw)
		}
	}
	return s
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

// defaultTTL 은 web-push (Node) 의 기본값(4주) 을 그대로 따라간다.
// SherClockHolmes/webpush-go 는 TTL 기본값이 0(즉시 폐기) 이라 명시적으로 줘야 한다.
const defaultTTL = 60 * 60 * 24 * 28

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
			TTL:             defaultTTL,
		})
		if sendErr != nil {
			failCount++
			log.Printf("[Push] 발송 실패: endpoint=%s, error=%v", sub.Endpoint, sendErr)
			continue
		}

		statusCode := resp.StatusCode
		bodyBytes, _ := io.ReadAll(resp.Body)
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
		log.Printf("[Push] 발송 실패: endpoint=%s, statusCode=%d, body=%s",
			sub.Endpoint, statusCode, truncate(string(bodyBytes), 500))
	}

	log.Printf("[Push] 발송 완료: 성공=%d, 실패=%d, 만료=%d", successCount, failCount, expiredCount)
	return nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "...(truncated)"
}
