package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/dlddu/gatekeeper/backend/internal/models"
	"github.com/dlddu/gatekeeper/backend/internal/util"
)

type RequestStore struct {
	db *sql.DB
}

func NewRequestStore(db *sql.DB) *RequestStore {
	return &RequestStore{db: db}
}

const requestColumns = `id, externalId, context, requesterName, status, timeoutSeconds, expiresAt, createdAt, updatedAt, processedAt, processedById`

var ErrUniqueViolation = errors.New("unique constraint violation")

func scanRequest(row interface{ Scan(...any) error }) (*models.Request, error) {
	var r models.Request
	var status string
	var timeoutSeconds sql.NullInt64
	var expiresAt sql.NullTime
	var processedAt sql.NullTime
	var processedByID sql.NullString
	if err := row.Scan(
		&r.ID, &r.ExternalID, &r.Context, &r.RequesterName, &status,
		&timeoutSeconds, &expiresAt, &r.CreatedAt, &r.UpdatedAt, &processedAt, &processedByID,
	); err != nil {
		return nil, err
	}
	r.Status = models.RequestStatus(status)
	if timeoutSeconds.Valid {
		v := int(timeoutSeconds.Int64)
		r.TimeoutSeconds = &v
	}
	if expiresAt.Valid {
		r.ExpiresAt = &expiresAt.Time
	}
	if processedAt.Valid {
		r.ProcessedAt = &processedAt.Time
	}
	if processedByID.Valid {
		r.ProcessedByID = &processedByID.String
	}
	return &r, nil
}

type CreateRequestInput struct {
	ExternalID     string
	Context        string
	RequesterName  string
	TimeoutSeconds *int
	ExpiresAt      *time.Time
	Status         models.RequestStatus
	ProcessedAt    *time.Time
	ProcessedByID  *string
}

func (s *RequestStore) Create(ctx context.Context, in CreateRequestInput) (*models.Request, error) {
	now := time.Now().UTC()
	id := util.NewID()
	status := in.Status
	if status == "" {
		status = models.StatusPending
	}

	var (
		timeoutArg     any
		expiresAtArg   any
		processedAt    any
		processedByID  any
	)
	if in.TimeoutSeconds != nil {
		timeoutArg = *in.TimeoutSeconds
	}
	if in.ExpiresAt != nil {
		expiresAtArg = util.DBTime(*in.ExpiresAt)
	}
	if in.ProcessedAt != nil {
		processedAt = util.DBTime(*in.ProcessedAt)
	}
	if in.ProcessedByID != nil {
		processedByID = *in.ProcessedByID
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO "Request" (id, externalId, context, requesterName, status, timeoutSeconds, expiresAt, createdAt, updatedAt, processedAt, processedById)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, id, in.ExternalID, in.Context, in.RequesterName, string(status), timeoutArg, expiresAtArg, util.DBTime(now), util.DBTime(now), processedAt, processedByID)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrUniqueViolation
		}
		return nil, fmt.Errorf("create request: %w", err)
	}

	return s.FindByID(ctx, id)
}

func (s *RequestStore) FindByID(ctx context.Context, id string) (*models.Request, error) {
	row := s.db.QueryRowContext(ctx, `SELECT `+requestColumns+` FROM "Request" WHERE id = ?`, id)
	r, err := scanRequest(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	return r, err
}

func (s *RequestStore) ListByStatus(ctx context.Context, status *models.RequestStatus) ([]*models.Request, error) {
	query := `SELECT ` + requestColumns + ` FROM "Request"`
	args := []any{}
	if status != nil {
		query += ` WHERE status = ?`
		args = append(args, string(*status))
	}
	query += ` ORDER BY createdAt DESC`

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list requests: %w", err)
	}
	defer rows.Close()

	var out []*models.Request
	for rows.Next() {
		r, err := scanRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// ListProcessed returns processed (APPROVED/REJECTED/EXPIRED) requests using
// cursor pagination ordered by processedAt DESC.
func (s *RequestStore) ListProcessed(ctx context.Context, limit int, cursor string) ([]*models.Request, error) {
	query := `SELECT ` + requestColumns + ` FROM "Request" WHERE status IN ('APPROVED','REJECTED','EXPIRED')`
	args := []any{}

	if cursor != "" {
		// cursor is the id of the last item from the previous page; we need the row's processedAt
		// to keep the same order. Use a sub-query to find it.
		query += ` AND (
			processedAt < (SELECT processedAt FROM "Request" WHERE id = ?)
			OR (processedAt = (SELECT processedAt FROM "Request" WHERE id = ?) AND id < ?)
		)`
		args = append(args, cursor, cursor, cursor)
	}

	query += ` ORDER BY processedAt DESC, id DESC LIMIT ?`
	args = append(args, limit)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list processed requests: %w", err)
	}
	defer rows.Close()

	var out []*models.Request
	for rows.Next() {
		r, err := scanRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

func (s *RequestStore) ListPending(ctx context.Context) ([]*models.Request, error) {
	pending := models.StatusPending
	return s.ListByStatus(ctx, &pending)
}

func (s *RequestStore) UpdateStatus(ctx context.Context, id string, status models.RequestStatus) (*models.Request, error) {
	now := time.Now().UTC()
	_, err := s.db.ExecContext(ctx, `UPDATE "Request" SET status = ?, updatedAt = ? WHERE id = ?`, string(status), util.DBTime(now), id)
	if err != nil {
		return nil, fmt.Errorf("update request status: %w", err)
	}
	return s.FindByID(ctx, id)
}

func (s *RequestStore) Process(ctx context.Context, id string, status models.RequestStatus, processedByID string) (*models.Request, error) {
	now := time.Now().UTC()
	nowStr := util.DBTime(now)
	_, err := s.db.ExecContext(ctx, `
		UPDATE "Request" SET status = ?, processedAt = ?, processedById = ?, updatedAt = ? WHERE id = ?
	`, string(status), nowStr, processedByID, nowStr, id)
	if err != nil {
		return nil, fmt.Errorf("process request: %w", err)
	}
	return s.FindByID(ctx, id)
}

func isUniqueViolation(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "UNIQUE constraint failed") || strings.Contains(msg, "constraint failed: UNIQUE")
}
