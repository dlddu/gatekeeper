package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/dlddu/gatekeeper/backend/internal/auth"
	"github.com/dlddu/gatekeeper/backend/internal/httpx"
	"github.com/dlddu/gatekeeper/backend/internal/models"
	"github.com/dlddu/gatekeeper/backend/internal/store"
	"github.com/go-chi/chi/v5"
)

type MeHandler struct {
	Users         *store.UserStore
	Requests      *store.RequestStore
	Subscriptions *store.PushSubscriptionStore
}

func NewMeHandler(users *store.UserStore, requests *store.RequestStore, subs *store.PushSubscriptionStore) *MeHandler {
	return &MeHandler{Users: users, Requests: requests, Subscriptions: subs}
}

func (h *MeHandler) Get(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"id":               user.ID,
		"username":         user.Username,
		"email":            user.Email,
		"displayName":      user.DisplayName,
		"autheliaId":       user.AutheliaID,
		"autoResponseMode": user.AutoResponseMode,
	})
}

type updateAutoResponseModeBody struct {
	Mode string `json:"mode"`
}

func (h *MeHandler) UpdateAutoResponseMode(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "인증이 필요합니다")
		return
	}

	var body updateAutoResponseModeBody
	if err := decodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if !models.IsValidAutoResponseMode(body.Mode) {
		httpx.Error(w, http.StatusBadRequest, "mode must be one of: NONE, AUTO_APPROVE, AUTO_REJECT")
		return
	}

	updated, err := h.Users.UpdateAutoResponseMode(r.Context(), user.ID, models.AutoResponseMode(body.Mode))
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to update")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]any{"autoResponseMode": updated.AutoResponseMode})
}

type pendingItem struct {
	ID             string                `json:"id"`
	ExternalID     string                `json:"externalId"`
	Context        string                `json:"context"`
	RequesterName  string                `json:"requesterName"`
	Status         models.RequestStatus  `json:"status"`
	TimeoutSeconds *int                  `json:"timeoutSeconds"`
	CreatedAt      time.Time             `json:"createdAt"`
	ExpiresAt      *string               `json:"expiresAt"`
}

func (h *MeHandler) ListPending(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.UserFromContext(r.Context()); !ok {
		httpx.Error(w, http.StatusUnauthorized, "인증이 필요합니다")
		return
	}

	pending, err := h.Requests.ListPending(r.Context())
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to list")
		return
	}

	now := time.Now().UTC()
	result := make([]pendingItem, 0, len(pending))

	for _, req := range pending {
		var expiresAt *string
		if req.TimeoutSeconds != nil {
			expiresAtTime := req.CreatedAt.Add(time.Duration(*req.TimeoutSeconds) * time.Second)
			s := expiresAtTime.UTC().Format(time.RFC3339Nano)
			expiresAt = &s

			if !expiresAtTime.After(now) {
				if _, err := h.Requests.UpdateStatus(r.Context(), req.ID, models.StatusExpired); err != nil {
					httpx.Error(w, http.StatusInternalServerError, "failed to expire")
					return
				}
				continue
			}
		}

		result = append(result, pendingItem{
			ID:             req.ID,
			ExternalID:     req.ExternalID,
			Context:        req.Context,
			RequesterName:  req.RequesterName,
			Status:         req.Status,
			TimeoutSeconds: req.TimeoutSeconds,
			CreatedAt:      req.CreatedAt,
			ExpiresAt:      expiresAt,
		})
	}

	httpx.JSON(w, http.StatusOK, map[string]any{"requests": result, "count": len(result)})
}

type historyItem struct {
	ID            string               `json:"id"`
	ExternalID    string               `json:"externalId"`
	Status        models.RequestStatus `json:"status"`
	ProcessedAt   *time.Time           `json:"processedAt"`
	Context       string               `json:"context"`
	RequesterName string               `json:"requesterName"`
	CreatedAt     time.Time            `json:"createdAt"`
}

func (h *MeHandler) ListHistory(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.UserFromContext(r.Context()); !ok {
		httpx.Error(w, http.StatusUnauthorized, "인증이 필요합니다")
		return
	}

	q := r.URL.Query()
	limit := 10
	if v := q.Get("limit"); v != "" {
		if parsed, err := strconv.Atoi(v); err == nil && parsed > 0 {
			limit = parsed
		}
	}
	cursor := q.Get("cursor")

	rows, err := h.Requests.ListProcessed(r.Context(), limit+1, cursor)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to list history")
		return
	}

	hasMore := len(rows) > limit
	items := rows
	if hasMore {
		items = rows[:limit]
	}

	out := make([]historyItem, 0, len(items))
	for _, req := range items {
		out = append(out, historyItem{
			ID:            req.ID,
			ExternalID:    req.ExternalID,
			Status:        req.Status,
			ProcessedAt:   req.ProcessedAt,
			Context:       req.Context,
			RequesterName: req.RequesterName,
			CreatedAt:     req.CreatedAt,
		})
	}

	var nextCursor *string
	if hasMore && len(items) > 0 {
		c := items[len(items)-1].ID
		nextCursor = &c
	}

	httpx.JSON(w, http.StatusOK, map[string]any{
		"items":      out,
		"hasMore":    hasMore,
		"nextCursor": nextCursor,
	})
}

type meRequestDetail struct {
	ID             string               `json:"id"`
	ExternalID     string               `json:"externalId"`
	Context        string               `json:"context"`
	RequesterName  string               `json:"requesterName"`
	Status         models.RequestStatus `json:"status"`
	TimeoutSeconds *int                 `json:"timeoutSeconds"`
	ExpiresAt      *string              `json:"expiresAt"`
	CreatedAt      time.Time            `json:"createdAt"`
	ProcessedAt    *time.Time           `json:"processedAt"`
	ProcessedByID  *string              `json:"processedById"`
}

func (h *MeHandler) GetRequest(w http.ResponseWriter, r *http.Request) {
	if _, ok := auth.UserFromContext(r.Context()); !ok {
		httpx.Error(w, http.StatusUnauthorized, "인증이 필요합니다")
		return
	}

	id := chi.URLParam(r, "id")
	found, err := h.Requests.FindByID(r.Context(), id)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to load")
		return
	}
	if found == nil {
		httpx.Error(w, http.StatusNotFound, "Request not found")
		return
	}

	status := found.Status
	var expiresAt *string
	if found.TimeoutSeconds != nil {
		expiresAtTime := found.CreatedAt.Add(time.Duration(*found.TimeoutSeconds) * time.Second)
		s := expiresAtTime.UTC().Format(time.RFC3339Nano)
		expiresAt = &s

		if found.Status == models.StatusPending && !expiresAtTime.After(time.Now().UTC()) {
			if _, err := h.Requests.UpdateStatus(r.Context(), found.ID, models.StatusExpired); err != nil {
				httpx.Error(w, http.StatusInternalServerError, "failed to expire")
				return
			}
			status = models.StatusExpired
		}
	}

	httpx.JSON(w, http.StatusOK, meRequestDetail{
		ID:             found.ID,
		ExternalID:     found.ExternalID,
		Context:        found.Context,
		RequesterName:  found.RequesterName,
		Status:         status,
		TimeoutSeconds: found.TimeoutSeconds,
		ExpiresAt:      expiresAt,
		CreatedAt:      found.CreatedAt,
		ProcessedAt:    found.ProcessedAt,
		ProcessedByID:  found.ProcessedByID,
	})
}

type subscribeBody struct {
	Endpoint string `json:"endpoint"`
	Keys     *struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
	P256dh string `json:"p256dh"`
	Auth   string `json:"auth"`
}

func (h *MeHandler) Subscribe(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "인증이 필요합니다")
		return
	}

	var body subscribeBody
	if err := decodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	p256dh := body.P256dh
	auth := body.Auth
	if body.Keys != nil {
		if body.Keys.P256dh != "" {
			p256dh = body.Keys.P256dh
		}
		if body.Keys.Auth != "" {
			auth = body.Keys.Auth
		}
	}

	if body.Endpoint == "" || p256dh == "" || auth == "" {
		httpx.Error(w, http.StatusBadRequest, "endpoint, p256dh, auth는 필수입니다")
		return
	}

	if existing, err := h.Subscriptions.FindByEndpoint(r.Context(), body.Endpoint); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to query subscription")
		return
	} else if existing != nil {
		httpx.JSON(w, http.StatusOK, existing)
		return
	}

	created, err := h.Subscriptions.Create(r.Context(), user.ID, body.Endpoint, p256dh, auth)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to subscribe")
		return
	}
	httpx.JSON(w, http.StatusCreated, created)
}

type unsubscribeBody struct {
	Endpoint string `json:"endpoint"`
}

func (h *MeHandler) Unsubscribe(w http.ResponseWriter, r *http.Request) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "인증이 필요합니다")
		return
	}

	var body unsubscribeBody
	if err := decodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	existing, err := h.Subscriptions.FindByEndpoint(r.Context(), body.Endpoint)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to query subscription")
		return
	}
	if existing == nil {
		httpx.Error(w, http.StatusNotFound, "구독 정보를 찾을 수 없습니다")
		return
	}

	if existing.UserID != user.ID {
		httpx.Error(w, http.StatusForbidden, "해당 구독을 삭제할 권한이 없습니다")
		return
	}

	if err := h.Subscriptions.DeleteByEndpoint(r.Context(), body.Endpoint); err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to unsubscribe")
		return
	}

	httpx.JSON(w, http.StatusOK, map[string]string{"message": "구독이 해제되었습니다"})
}

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(dst); err != nil {
		return err
	}
	return nil
}

// avoid unused import for errors when strict.
var _ = errors.New
