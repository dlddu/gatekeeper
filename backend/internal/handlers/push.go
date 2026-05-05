package handlers

import (
	"context"
	"log"
	"net/http"

	"github.com/dlddu/gatekeeper/backend/internal/httpx"
	"github.com/dlddu/gatekeeper/backend/internal/push"
	"github.com/dlddu/gatekeeper/backend/internal/store"
)

type PushHandler struct {
	Subscriptions *store.PushSubscriptionStore
	Push          *push.Service
}

func NewPushHandler(subs *store.PushSubscriptionStore, p *push.Service) *PushHandler {
	return &PushHandler{Subscriptions: subs, Push: p}
}

type sendPushBody struct {
	UserID string `json:"userId"`
	Title  string `json:"title"`
	Body   string `json:"body"`
}

func (h *PushHandler) Send(w http.ResponseWriter, r *http.Request) {
	var body sendPushBody
	if err := decodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	log.Printf("[Push API] /api/push/send 요청: userId=%s, title=%q", body.UserID, body.Title)

	subs, err := h.Subscriptions.ListByUser(r.Context(), body.UserID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to list subscriptions")
		return
	}
	if len(subs) == 0 {
		log.Printf("[Push API] 구독 없음: userId=%s", body.UserID)
		httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "sent": 0})
		return
	}

	sent := 0
	if err := h.Push.Send(r.Context(), push.SendOptions{
		Subscriptions: subs,
		Title:         body.Title,
		Body:          body.Body,
		OnExpired: func(ctx context.Context, endpoint string) error {
			return h.Subscriptions.DeleteByEndpoint(ctx, endpoint)
		},
		OnSuccess: func() { sent++ },
	}); err != nil {
		httpx.Error(w, http.StatusInternalServerError, err.Error())
		return
	}

	log.Printf("[Push API] /api/push/send 완료: userId=%s, sent=%d", body.UserID, sent)
	httpx.JSON(w, http.StatusOK, map[string]any{"success": true, "sent": sent})
}
