package handlers

import (
	"database/sql"
	"net/http"

	"github.com/dlddu/gatekeeper/backend/internal/httpx"
)

type HealthHandler struct {
	DB *sql.DB
}

func NewHealthHandler(db *sql.DB) *HealthHandler {
	return &HealthHandler{DB: db}
}

func (h *HealthHandler) Get(w http.ResponseWriter, r *http.Request) {
	if _, err := h.DB.ExecContext(r.Context(), "SELECT 1"); err != nil {
		httpx.JSON(w, http.StatusServiceUnavailable, map[string]string{
			"status":  "error",
			"message": "Database connection failed",
		})
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
