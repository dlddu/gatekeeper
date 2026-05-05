package server

import (
	"context"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/dlddu/gatekeeper/backend/internal/config"
	"github.com/dlddu/gatekeeper/backend/internal/db"
)

// Prisma는 SQLite DATETIME 컬럼을 ISO 8601 (yyyy-MM-ddTHH:mm:ss.SSS{Z|±HH:mm})
// 형식으로 읽는다. modernc.org/sqlite 의 기본 직렬화 ("yyyy-MM-dd HH:mm:ss.fff... ±HHMM TZ")
// 그대로 두면 Prisma는 null로 인식하므로, store 레이어에서 항상 ISO 형식으로 써야 한다.
func TestDateTimeIsPrismaCompatible(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "iso.db")

	conn, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer conn.Close()
	if err := db.Migrate(conn); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	cfg := &config.Config{
		ListenAddr:   "127.0.0.1:0",
		DatabaseURL:  dbPath,
		APISecretKey: "test-key",
	}
	srv := New(conn, cfg)
	ts := httptest.NewServer(srv.Handler)
	defer ts.Close()

	// 1) Forward-auth 헤더로 사용자 자동 생성 (createdAt/updatedAt 둘 다 INSERT)
	doForwardAuth(t, ts.URL+"/api/me")

	// 2) 동일 사용자에 대해 한 번 더 호출하여 UPDATE 경로의 updatedAt 도 검증
	doForwardAuth(t, ts.URL+"/api/me")

	// 3) 자동 응답 모드 변경(또 다른 UPDATE 경로)
	patch, _ := http.NewRequest(http.MethodPatch, ts.URL+"/api/me/auto-response-mode",
		strings.NewReader(`{"mode":"AUTO_APPROVE"}`))
	patch.Header.Set("Remote-User", "alice")
	patch.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(patch)
	if err != nil {
		t.Fatalf("PATCH auto-response-mode: %v", err)
	}
	resp.Body.Close()

	// Raw DB 읽기 — DATETIME 컬럼은 모두 Prisma가 파싱 가능한 ISO 형식이어야 한다.
	row := conn.QueryRowContext(context.Background(),
		`SELECT createdAt, updatedAt FROM "User" WHERE username = ?`, "alice")
	var createdAt, updatedAt string
	if err := row.Scan(&createdAt, &updatedAt); err != nil {
		t.Fatalf("scan datetime: %v", err)
	}

	// "2026-05-05T10:00:00.000Z" 또는 "2026-05-05T10:00:00.000+00:00" 형식
	isoRE := regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(Z|[+-]\d{2}:\d{2})$`)
	if !isoRE.MatchString(createdAt) {
		t.Errorf("createdAt is not ISO 8601 with millis: %q", createdAt)
	}
	if !isoRE.MatchString(updatedAt) {
		t.Errorf("updatedAt is not ISO 8601 with millis: %q", updatedAt)
	}
}

func doForwardAuth(t *testing.T, url string) {
	t.Helper()
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Remote-User", "alice")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	resp.Body.Close()
}
