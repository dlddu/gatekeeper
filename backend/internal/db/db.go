package db

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	_ "modernc.org/sqlite"
)

func Open(databaseURL string) (*sql.DB, error) {
	dsn := normalizeDSN(databaseURL)

	db, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("open sqlite: %w", err)
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)
	db.SetConnMaxLifetime(0)

	pragmas := []string{
		"PRAGMA busy_timeout = 5000",
		"PRAGMA journal_mode = WAL",
		"PRAGMA foreign_keys = ON",
		"PRAGMA synchronous = NORMAL",
	}
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	for _, p := range pragmas {
		if _, err := db.ExecContext(ctx, p); err != nil {
			return nil, fmt.Errorf("apply pragma %q: %w", p, err)
		}
	}

	return db, nil
}

// normalizeDSN converts Prisma-style "file:..." URLs to a path that
// modernc.org/sqlite understands.
func normalizeDSN(databaseURL string) string {
	if strings.HasPrefix(databaseURL, "file:") {
		path := strings.TrimPrefix(databaseURL, "file:")
		return path
	}
	return databaseURL
}
