package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/dlddu/gatekeeper/backend/internal/models"
	"github.com/dlddu/gatekeeper/backend/internal/util"
)

type PushSubscriptionStore struct {
	db *sql.DB
}

func NewPushSubscriptionStore(db *sql.DB) *PushSubscriptionStore {
	return &PushSubscriptionStore{db: db}
}

const subColumns = `id, userId, endpoint, p256dh, auth, createdAt`

func scanSubscription(row interface{ Scan(...any) error }) (*models.PushSubscription, error) {
	var s models.PushSubscription
	if err := row.Scan(&s.ID, &s.UserID, &s.Endpoint, &s.P256dh, &s.Auth, &s.CreatedAt); err != nil {
		return nil, err
	}
	return &s, nil
}

func (s *PushSubscriptionStore) FindByEndpoint(ctx context.Context, endpoint string) (*models.PushSubscription, error) {
	row := s.db.QueryRowContext(ctx, `SELECT `+subColumns+` FROM "PushSubscription" WHERE endpoint = ?`, endpoint)
	sub, err := scanSubscription(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return sub, err
}

func (s *PushSubscriptionStore) ListByUser(ctx context.Context, userID string) ([]*models.PushSubscription, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT `+subColumns+` FROM "PushSubscription" WHERE userId = ?`, userID)
	if err != nil {
		return nil, fmt.Errorf("list subscriptions: %w", err)
	}
	defer rows.Close()

	var out []*models.PushSubscription
	for rows.Next() {
		sub, err := scanSubscription(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, sub)
	}
	return out, rows.Err()
}

func (s *PushSubscriptionStore) Create(ctx context.Context, userID, endpoint, p256dh, auth string) (*models.PushSubscription, error) {
	id := util.NewID()
	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO "PushSubscription" (id, userId, endpoint, p256dh, auth, createdAt)
		VALUES (?, ?, ?, ?, ?, ?)
	`, id, userID, endpoint, p256dh, auth, util.DBTime(now))
	if err != nil {
		return nil, fmt.Errorf("create subscription: %w", err)
	}
	return s.FindByEndpoint(ctx, endpoint)
}

func (s *PushSubscriptionStore) DeleteByEndpoint(ctx context.Context, endpoint string) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM "PushSubscription" WHERE endpoint = ?`, endpoint)
	if err != nil {
		return fmt.Errorf("delete subscription: %w", err)
	}
	return nil
}
