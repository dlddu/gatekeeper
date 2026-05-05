package auth

import (
	"net/http"

	"github.com/dlddu/gatekeeper/backend/internal/httpx"
)

// RequireAPIKey returns middleware that validates the x-api-key header
// against the configured secret. Equivalent to the Next.js API_SECRET_KEY check.
func RequireAPIKey(secret string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			key := r.Header.Get("x-api-key")
			if key == "" || key != secret {
				httpx.Error(w, http.StatusUnauthorized, "Unauthorized")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
