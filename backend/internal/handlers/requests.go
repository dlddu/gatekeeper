package handlers

import (
	"context"
	"errors"
	"log"
	"net/http"
	"time"

	"github.com/dlddu/gatekeeper/backend/internal/auth"
	"github.com/dlddu/gatekeeper/backend/internal/httpx"
	"github.com/dlddu/gatekeeper/backend/internal/models"
	"github.com/dlddu/gatekeeper/backend/internal/push"
	"github.com/dlddu/gatekeeper/backend/internal/store"
	"github.com/go-chi/chi/v5"
)

type RequestsHandler struct {
	Users         *store.UserStore
	Requests      *store.RequestStore
	Subscriptions *store.PushSubscriptionStore
	Push          *push.Service
}

func NewRequestsHandler(users *store.UserStore, requests *store.RequestStore, subs *store.PushSubscriptionStore, pushSvc *push.Service) *RequestsHandler {
	return &RequestsHandler{Users: users, Requests: requests, Subscriptions: subs, Push: pushSvc}
}

type createRequestBody struct {
	ExternalID     string  `json:"externalId"`
	Context        string  `json:"context"`
	RequesterName  string  `json:"requesterName"`
	TimeoutSeconds *int    `json:"timeoutSeconds"`
	UserID         *string `json:"userId"`
}

type createRequestResponse struct {
	ID             string               `json:"id"`
	ExternalID     string               `json:"externalId"`
	Context        string               `json:"context"`
	RequesterName  string               `json:"requesterName"`
	Status         models.RequestStatus `json:"status"`
	TimeoutSeconds *int                 `json:"timeoutSeconds"`
	ExpiresAt      *time.Time           `json:"expiresAt"`
	CreatedAt      time.Time            `json:"createdAt"`
	AutoApproved   bool                 `json:"autoApproved,omitempty"`
	AutoRejected   bool                 `json:"autoRejected,omitempty"`
}

func (h *RequestsHandler) Create(w http.ResponseWriter, r *http.Request) {
	var body createRequestBody
	if err := decodeJSON(r, &body); err != nil {
		httpx.Error(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if body.ExternalID == "" || body.Context == "" || body.RequesterName == "" {
		httpx.Error(w, http.StatusBadRequest, "externalId, context, and requesterName are required")
		return
	}

	var targetUser *models.User
	if body.UserID != nil && *body.UserID != "" {
		u, err := h.Users.FindByID(r.Context(), *body.UserID)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "failed to lookup user")
			return
		}
		if u == nil {
			httpx.Error(w, http.StatusBadRequest, "User not found")
			return
		}
		targetUser = u
	}

	now := time.Now().UTC()
	var expiresAt *time.Time
	if body.TimeoutSeconds != nil {
		t := now.Add(time.Duration(*body.TimeoutSeconds) * time.Second)
		expiresAt = &t
	}

	autoMode := models.AutoResponseNone
	if targetUser != nil {
		autoMode = targetUser.AutoResponseMode
	}
	isAuto := autoMode == models.AutoResponseApprove || autoMode == models.AutoResponseReject

	in := store.CreateRequestInput{
		ExternalID:     body.ExternalID,
		Context:        body.Context,
		RequesterName:  body.RequesterName,
		TimeoutSeconds: body.TimeoutSeconds,
		ExpiresAt:      expiresAt,
	}

	if isAuto {
		switch autoMode {
		case models.AutoResponseApprove:
			in.Status = models.StatusApproved
		case models.AutoResponseReject:
			in.Status = models.StatusRejected
		}
		nowCopy := now
		in.ProcessedAt = &nowCopy
		in.ProcessedByID = body.UserID
	}

	created, err := h.Requests.Create(r.Context(), in)
	if err != nil {
		if errors.Is(err, store.ErrUniqueViolation) {
			httpx.Error(w, http.StatusConflict, "Request with this externalId already exists")
			return
		}
		httpx.Error(w, http.StatusInternalServerError, "failed to create request")
		return
	}

	if body.UserID != nil && *body.UserID != "" && !isAuto {
		go h.dispatchPush(*body.UserID, created)
	}

	resp := createRequestResponse{
		ID:             created.ID,
		ExternalID:     created.ExternalID,
		Context:        created.Context,
		RequesterName:  created.RequesterName,
		Status:         created.Status,
		TimeoutSeconds: created.TimeoutSeconds,
		ExpiresAt:      created.ExpiresAt,
		CreatedAt:      created.CreatedAt,
	}
	switch autoMode {
	case models.AutoResponseApprove:
		resp.AutoApproved = true
	case models.AutoResponseReject:
		resp.AutoRejected = true
	}

	httpx.JSON(w, http.StatusCreated, resp)
}

// dispatchPush is fire-and-forget; failures must not affect the request creation
// response, mirroring lib/push.ts's behavior.
func (h *RequestsHandler) dispatchPush(userID string, created *models.Request) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("[Requests] Push goroutine panic: %v", rec)
		}
	}()

	ctx, cancel := backgroundContextWithTimeout(30 * time.Second)
	defer cancel()

	subs, err := h.Subscriptions.ListByUser(ctx, userID)
	if err != nil {
		log.Printf("[Requests] Push 발송 중 오류: userId=%s, requestId=%s, error=%v", userID, created.ID, err)
		return
	}
	log.Printf("[Requests] Push 발송 시도: userId=%s, requestId=%s, 구독수=%d", userID, created.ID, len(subs))
	if len(subs) == 0 {
		return
	}

	if err := h.Push.Send(ctx, push.SendOptions{
		Subscriptions: subs,
		Title:         push.TitleApprovalRequest,
		Body:          created.Context,
		OnExpired: func(ctx2 context.Context, endpoint string) error {
			return h.Subscriptions.DeleteByEndpoint(ctx2, endpoint)
		},
	}); err != nil {
		log.Printf("[Requests] Push 발송 중 오류: userId=%s, requestId=%s, error=%v", userID, created.ID, err)
	}
}

func (h *RequestsHandler) List(w http.ResponseWriter, r *http.Request) {
	statusParam := r.URL.Query().Get("status")
	var statusFilter *models.RequestStatus
	if statusParam != "" {
		if !models.IsValidRequestStatus(statusParam) {
			httpx.Error(w, http.StatusBadRequest, "Invalid status value: "+statusParam)
			return
		}
		s := models.RequestStatus(statusParam)
		statusFilter = &s
	}

	rows, err := h.Requests.ListByStatus(r.Context(), statusFilter)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to list")
		return
	}
	if rows == nil {
		rows = []*models.Request{}
	}
	httpx.JSON(w, http.StatusOK, rows)
}

func (h *RequestsHandler) GetByID(w http.ResponseWriter, r *http.Request) {
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

	if found.Status == models.StatusPending && found.ExpiresAt != nil && found.ExpiresAt.Before(time.Now().UTC()) {
		updated, err := h.Requests.UpdateStatus(r.Context(), id, models.StatusExpired)
		if err != nil {
			httpx.Error(w, http.StatusInternalServerError, "failed to expire")
			return
		}
		httpx.JSON(w, http.StatusOK, updated)
		return
	}

	httpx.JSON(w, http.StatusOK, found)
}

func (h *RequestsHandler) Approve(w http.ResponseWriter, r *http.Request) {
	h.process(w, r, models.StatusApproved)
}

func (h *RequestsHandler) Reject(w http.ResponseWriter, r *http.Request) {
	h.process(w, r, models.StatusRejected)
}

func (h *RequestsHandler) process(w http.ResponseWriter, r *http.Request, status models.RequestStatus) {
	user, ok := auth.UserFromContext(r.Context())
	if !ok {
		httpx.Error(w, http.StatusUnauthorized, "Unauthorized")
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
	if found.Status == models.StatusApproved || found.Status == models.StatusRejected {
		httpx.Error(w, http.StatusConflict, "Request has already been processed")
		return
	}

	updated, err := h.Requests.Process(r.Context(), id, status, user.ID)
	if err != nil {
		httpx.Error(w, http.StatusInternalServerError, "failed to process")
		return
	}
	httpx.JSON(w, http.StatusOK, updated)
}
