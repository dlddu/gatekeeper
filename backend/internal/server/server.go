package server

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/dlddu/gatekeeper/backend/internal/auth"
	"github.com/dlddu/gatekeeper/backend/internal/config"
	"github.com/dlddu/gatekeeper/backend/internal/handlers"
	"github.com/dlddu/gatekeeper/backend/internal/push"
	"github.com/dlddu/gatekeeper/backend/internal/store"
	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func New(db *sql.DB, cfg *config.Config) *http.Server {
	users := store.NewUserStore(db)
	requests := store.NewRequestStore(db)
	subs := store.NewPushSubscriptionStore(db)

	pushSvc := push.NewService(cfg.VAPIDSubject, cfg.VAPIDPublicKey, cfg.VAPIDPrivateKey)

	healthH := handlers.NewHealthHandler(db)
	meH := handlers.NewMeHandler(users, requests, subs)
	requestsH := handlers.NewRequestsHandler(users, requests, subs, pushSvc)
	pushH := handlers.NewPushHandler(subs, pushSvc)

	r := chi.NewRouter()
	r.Use(middleware.RealIP)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(middleware.Timeout(60 * time.Second))

	r.Route("/api", func(r chi.Router) {
		r.Get("/health", healthH.Get)

		// /api/requests - public list, API key for create
		r.Route("/requests", func(r chi.Router) {
			r.Get("/", requestsH.List)
			r.With(auth.RequireAPIKey(cfg.APISecretKey)).Post("/", requestsH.Create)

			r.Route("/{id}", func(r chi.Router) {
				r.With(auth.RequireAPIKey(cfg.APISecretKey)).Get("/", requestsH.GetByID)
				r.With(auth.RequireForwardAuth(users, "Unauthorized")).Patch("/approve", requestsH.Approve)
				r.With(auth.RequireForwardAuth(users, "Unauthorized")).Patch("/reject", requestsH.Reject)
			})
		})

		// /api/me - all forward-auth protected
		r.Route("/me", func(r chi.Router) {
			r.Use(auth.RequireForwardAuth(users, "인증이 필요합니다"))
			r.Get("/", meH.Get)
			r.Patch("/auto-response-mode", meH.UpdateAutoResponseMode)
			r.Get("/requests/pending", meH.ListPending)
			r.Get("/requests/history", meH.ListHistory)
			r.Get("/requests/{id}", meH.GetRequest)
			r.Post("/push/subscribe", meH.Subscribe)
			r.Delete("/push/unsubscribe", meH.Unsubscribe)
		})

		// /api/push/send - API key
		r.With(auth.RequireAPIKey(cfg.APISecretKey)).Post("/push/send", pushH.Send)
	})

	return &http.Server{
		Addr:              cfg.ListenAddr,
		Handler:           r,
		ReadHeaderTimeout: 10 * time.Second,
	}
}
