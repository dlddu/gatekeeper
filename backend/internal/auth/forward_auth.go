package auth

import (
	"context"
	"net/http"

	"github.com/dlddu/gatekeeper/backend/internal/httpx"
	"github.com/dlddu/gatekeeper/backend/internal/models"
	"github.com/dlddu/gatekeeper/backend/internal/store"
)

type ctxKey int

const userKey ctxKey = iota

// UserFromContext returns the authenticated user attached to the request context.
func UserFromContext(ctx context.Context) (*models.User, bool) {
	u, ok := ctx.Value(userKey).(*models.User)
	return u, ok
}

// ResolveForwardAuthUser looks up (or upserts) the user implied by the
// Authelia forward-auth headers. Returns nil when no Remote-User header is
// present, mirroring the behavior of lib/forward-auth.ts.
func ResolveForwardAuthUser(ctx context.Context, r *http.Request, users *store.UserStore) (*models.User, error) {
	autheliaID := r.Header.Get("Remote-User")
	if autheliaID == "" {
		return nil, nil
	}

	username := autheliaID
	displayName := r.Header.Get("Remote-Name")

	var emailPtr *string
	if v := r.Header.Get("Remote-Email"); v != "" {
		emailPtr = &v
	}

	if existing, err := users.FindByAutheliaID(ctx, autheliaID); err != nil {
		return nil, err
	} else if existing != nil {
		return users.UpdateProfileByAutheliaID(ctx, autheliaID, emailPtr, displayName)
	}

	// authentik → authelia migration: try matching by username.
	if existing, err := users.FindByUsername(ctx, username); err != nil {
		return nil, err
	} else if existing != nil {
		return users.UpgradeLegacyByUsername(ctx, username, autheliaID, emailPtr, displayName)
	}

	user := &models.User{
		AutheliaID:  autheliaID,
		Username:    username,
		Email:       emailPtr,
		DisplayName: displayName,
	}
	if err := users.Create(ctx, user); err != nil {
		return nil, err
	}
	return user, nil
}

// RequireForwardAuth is HTTP middleware that resolves the forward-auth user
// and attaches it to the request context. Unauthenticated requests get 401.
func RequireForwardAuth(users *store.UserStore, message string) func(http.Handler) http.Handler {
	if message == "" {
		message = "Unauthorized"
	}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user, err := ResolveForwardAuthUser(r.Context(), r, users)
			if err != nil {
				httpx.Error(w, http.StatusInternalServerError, "internal error")
				return
			}
			if user == nil {
				httpx.Error(w, http.StatusUnauthorized, message)
				return
			}
			ctx := context.WithValue(r.Context(), userKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
