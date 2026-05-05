package server

import (
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/dlddu/gatekeeper/backend/internal/config"
	"github.com/dlddu/gatekeeper/backend/internal/db"
)

func setupStaticServer(t *testing.T) (*httptest.Server, string, func()) {
	t.Helper()
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")

	conn, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	if err := db.Migrate(conn); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	staticDir := filepath.Join(dir, "out")
	if err := os.MkdirAll(filepath.Join(staticDir, "history"), 0o755); err != nil {
		t.Fatalf("mkdir history: %v", err)
	}
	if err := os.MkdirAll(filepath.Join(staticDir, "requests", "_placeholder"), 0o755); err != nil {
		t.Fatalf("mkdir placeholder: %v", err)
	}

	mustWrite := func(path, body string) {
		full := filepath.Join(staticDir, path)
		if err := os.WriteFile(full, []byte(body), 0o644); err != nil {
			t.Fatalf("write %s: %v", path, err)
		}
	}
	mustWrite("index.html", "<html>home</html>")
	mustWrite("history/index.html", "<html>history</html>")
	mustWrite("requests/_placeholder/index.html", "<html>request shell</html>")
	mustWrite("404.html", "<html>not found</html>")
	mustWrite("sw.js", "// service worker")

	cfg := &config.Config{
		ListenAddr:   "127.0.0.1:0",
		DatabaseURL:  dbPath,
		APISecretKey: "test-key",
		StaticDir:    staticDir,
	}

	srv := New(conn, cfg)
	ts := httptest.NewServer(srv.Handler)
	cleanup := func() {
		ts.Close()
		conn.Close()
	}
	return ts, staticDir, cleanup
}

func mustGet(t *testing.T, url string) (*http.Response, string) {
	t.Helper()
	resp, err := http.Get(url)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		resp.Body.Close()
		t.Fatalf("read body: %v", err)
	}
	resp.Body.Close()
	return resp, string(body)
}

func TestStaticServesIndex(t *testing.T) {
	ts, _, cleanup := setupStaticServer(t)
	defer cleanup()

	resp, body := mustGet(t, ts.URL+"/")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	if body != "<html>home</html>" {
		t.Fatalf("body = %q", body)
	}
}

func TestStaticServesNamedRoute(t *testing.T) {
	ts, _, cleanup := setupStaticServer(t)
	defer cleanup()

	resp, body := mustGet(t, ts.URL+"/history/")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	if body != "<html>history</html>" {
		t.Fatalf("body = %q", body)
	}
}

func TestStaticDynamicRouteFallback(t *testing.T) {
	ts, _, cleanup := setupStaticServer(t)
	defer cleanup()

	resp, body := mustGet(t, ts.URL+"/requests/cmosabc123xyz/")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	if body != "<html>request shell</html>" {
		t.Fatalf("body = %q", body)
	}
}

// trailingSlash:false 빌드는 placeholder 가 _placeholder.html (디렉토리 없는
// 평면 파일) 로 떨어진다. fallback 이 그 layout 도 처리해야 한다.
func TestStaticDynamicRouteFlatPlaceholder(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")
	conn, err := db.Open(dbPath)
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	defer conn.Close()
	if err := db.Migrate(conn); err != nil {
		t.Fatalf("migrate: %v", err)
	}

	staticDir := filepath.Join(dir, "out")
	if err := os.MkdirAll(filepath.Join(staticDir, "requests"), 0o755); err != nil {
		t.Fatalf("mkdir: %v", err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "index.html"), []byte("home"), 0o644); err != nil {
		t.Fatalf("write index: %v", err)
	}
	if err := os.WriteFile(filepath.Join(staticDir, "requests", "_placeholder.html"), []byte("<html>flat shell</html>"), 0o644); err != nil {
		t.Fatalf("write placeholder: %v", err)
	}

	cfg := &config.Config{
		ListenAddr:   "127.0.0.1:0",
		DatabaseURL:  dbPath,
		APISecretKey: "test-key",
		StaticDir:    staticDir,
	}
	srv := New(conn, cfg)
	ts := httptest.NewServer(srv.Handler)
	defer ts.Close()

	resp, body := mustGet(t, ts.URL+"/requests/abc")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	if body != "<html>flat shell</html>" {
		t.Fatalf("body = %q", body)
	}
}

func TestStaticAPIStillRoutes(t *testing.T) {
	ts, _, cleanup := setupStaticServer(t)
	defer cleanup()

	resp, _ := mustGet(t, ts.URL+"/api/health")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("api/health status = %d", resp.StatusCode)
	}
}

func TestStaticServiceWorkerCacheHeaders(t *testing.T) {
	ts, _, cleanup := setupStaticServer(t)
	defer cleanup()

	resp, _ := mustGet(t, ts.URL+"/sw.js")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("sw.js status = %d", resp.StatusCode)
	}
	if got := resp.Header.Get("Cache-Control"); got != "no-cache, no-store, must-revalidate" {
		t.Fatalf("Cache-Control = %q", got)
	}
	if got := resp.Header.Get("Service-Worker-Allowed"); got != "/" {
		t.Fatalf("Service-Worker-Allowed = %q", got)
	}
}

func TestStaticUnknownPathServes404(t *testing.T) {
	ts, _, cleanup := setupStaticServer(t)
	defer cleanup()

	resp, body := mustGet(t, ts.URL+"/no-such-page/")
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d", resp.StatusCode)
	}
	if body != "<html>not found</html>" {
		t.Fatalf("body = %q", body)
	}
}
