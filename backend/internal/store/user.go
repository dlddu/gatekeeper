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

type UserStore struct {
	db *sql.DB
}

func NewUserStore(db *sql.DB) *UserStore {
	return &UserStore{db: db}
}

const userColumns = `id, username, email, autheliaId, displayName, autoResponseMode, createdAt, updatedAt`

func scanUser(row interface{ Scan(...any) error }) (*models.User, error) {
	var u models.User
	var email sql.NullString
	var mode string
	if err := row.Scan(&u.ID, &u.Username, &email, &u.AutheliaID, &u.DisplayName, &mode, &u.CreatedAt, &u.UpdatedAt); err != nil {
		return nil, err
	}
	if email.Valid {
		u.Email = &email.String
	}
	u.AutoResponseMode = models.AutoResponseMode(mode)
	return &u, nil
}

func (s *UserStore) FindByID(ctx context.Context, id string) (*models.User, error) {
	row := s.db.QueryRowContext(ctx, `SELECT `+userColumns+` FROM "User" WHERE id = ?`, id)
	u, err := scanUser(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return u, err
}

func (s *UserStore) FindByAutheliaID(ctx context.Context, autheliaID string) (*models.User, error) {
	row := s.db.QueryRowContext(ctx, `SELECT `+userColumns+` FROM "User" WHERE autheliaId = ?`, autheliaID)
	u, err := scanUser(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return u, err
}

func (s *UserStore) FindByUsername(ctx context.Context, username string) (*models.User, error) {
	row := s.db.QueryRowContext(ctx, `SELECT `+userColumns+` FROM "User" WHERE username = ?`, username)
	u, err := scanUser(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return u, err
}

func (s *UserStore) Create(ctx context.Context, u *models.User) error {
	if u.ID == "" {
		u.ID = util.NewID()
	}
	now := time.Now().UTC()
	if u.CreatedAt.IsZero() {
		u.CreatedAt = now
	}
	u.UpdatedAt = now
	if u.AutoResponseMode == "" {
		u.AutoResponseMode = models.AutoResponseNone
	}

	var email any
	if u.Email != nil {
		email = *u.Email
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO "User" (id, username, email, autheliaId, displayName, autoResponseMode, createdAt, updatedAt)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, u.ID, u.Username, email, u.AutheliaID, u.DisplayName, string(u.AutoResponseMode), util.DBTime(u.CreatedAt), util.DBTime(u.UpdatedAt))
	if err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

// UpdateProfileByAutheliaID updates email and displayName for a user identified by autheliaId.
func (s *UserStore) UpdateProfileByAutheliaID(ctx context.Context, autheliaID string, email *string, displayName string) (*models.User, error) {
	var emailArg any
	if email != nil {
		emailArg = *email
	}

	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `
		UPDATE "User" SET email = ?, displayName = ?, updatedAt = ? WHERE autheliaId = ?
	`, emailArg, displayName, util.DBTime(now), autheliaID)
	if err != nil {
		return nil, fmt.Errorf("update profile: %w", err)
	}
	return s.FindByAutheliaID(ctx, autheliaID)
}

// UpgradeLegacyByUsername sets the autheliaId for a user matched by username
// (used during the authentik → authelia transition).
func (s *UserStore) UpgradeLegacyByUsername(ctx context.Context, username, autheliaID string, email *string, displayName string) (*models.User, error) {
	var emailArg any
	if email != nil {
		emailArg = *email
	}

	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `
		UPDATE "User" SET autheliaId = ?, email = ?, displayName = ?, updatedAt = ? WHERE username = ?
	`, autheliaID, emailArg, displayName, util.DBTime(now), username)
	if err != nil {
		return nil, fmt.Errorf("upgrade legacy user: %w", err)
	}
	return s.FindByUsername(ctx, username)
}

func (s *UserStore) UpdateAutoResponseMode(ctx context.Context, id string, mode models.AutoResponseMode) (*models.User, error) {
	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `
		UPDATE "User" SET autoResponseMode = ?, updatedAt = ? WHERE id = ?
	`, string(mode), util.DBTime(now), id)
	if err != nil {
		return nil, fmt.Errorf("update auto response mode: %w", err)
	}
	return s.FindByID(ctx, id)
}
