package server

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/dlddu/gatekeeper/backend/internal/config"
	"github.com/dlddu/gatekeeper/backend/internal/db"
)

func setupTestServer(t *testing.T) (*httptest.Server, func()) {
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

	cfg := &config.Config{
		ListenAddr:   "127.0.0.1:0",
		DatabaseURL:  dbPath,
		APISecretKey: "test-key",
	}

	srv := New(conn, cfg)
	ts := httptest.NewServer(srv.Handler)
	cleanup := func() {
		ts.Close()
		conn.Close()
	}
	return ts, cleanup
}

func mustJSON(t *testing.T, resp *http.Response) map[string]any {
	t.Helper()
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	var out map[string]any
	if len(body) == 0 {
		return nil
	}
	if err := json.Unmarshal(body, &out); err != nil {
		t.Fatalf("unmarshal %q: %v", string(body), err)
	}
	return out
}

func TestHealth(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	resp, err := http.Get(ts.URL + "/api/health")
	if err != nil {
		t.Fatalf("GET /api/health: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	body := mustJSON(t, resp)
	if body["status"] != "ok" {
		t.Fatalf("status field = %v, want ok", body["status"])
	}
}

func TestCreateRequestRequiresAPIKey(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	body := strings.NewReader(`{"externalId":"e1","context":"c","requesterName":"r"}`)
	resp, err := http.Post(ts.URL+"/api/requests", "application/json", body)
	if err != nil {
		t.Fatalf("POST: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}

func TestCreateAndListRequest(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	payload := []byte(`{"externalId":"deploy-001","context":"prod","requesterName":"CI","timeoutSeconds":600}`)
	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/requests", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", "test-key")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create status = %d, want 201", resp.StatusCode)
	}
	created := mustJSON(t, resp)
	if created["externalId"] != "deploy-001" {
		t.Fatalf("externalId = %v", created["externalId"])
	}
	if created["status"] != "PENDING" {
		t.Fatalf("status = %v, want PENDING", created["status"])
	}

	// Duplicate externalId
	resp, err = http.DefaultClient.Do(mustReq(t, http.MethodPost, ts.URL+"/api/requests", payload, "test-key"))
	if err != nil {
		t.Fatalf("POST dup: %v", err)
	}
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("dup status = %d, want 409", resp.StatusCode)
	}

	// List
	resp, err = http.Get(ts.URL + "/api/requests")
	if err != nil {
		t.Fatalf("GET list: %v", err)
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	var arr []map[string]any
	if err := json.Unmarshal(body, &arr); err != nil {
		t.Fatalf("unmarshal list: %v", err)
	}
	if len(arr) != 1 {
		t.Fatalf("list len = %d, want 1", len(arr))
	}

	// Bad status
	resp, err = http.Get(ts.URL + "/api/requests?status=BOGUS")
	if err != nil {
		t.Fatalf("GET bad: %v", err)
	}
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("bad status = %d, want 400", resp.StatusCode)
	}
}

func TestMeRequiresAuth(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	resp, err := http.Get(ts.URL + "/api/me")
	if err != nil {
		t.Fatalf("GET /api/me: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}

func TestMeUpsertsForwardAuthUser(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	req, _ := http.NewRequest(http.MethodGet, ts.URL+"/api/me", nil)
	req.Header.Set("Remote-User", "alice")
	req.Header.Set("Remote-Email", "alice@example.com")
	req.Header.Set("Remote-Name", "Alice")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET /api/me: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	body := mustJSON(t, resp)
	if body["username"] != "alice" {
		t.Fatalf("username = %v, want alice", body["username"])
	}
	if body["autoResponseMode"] != "NONE" {
		t.Fatalf("autoResponseMode = %v, want NONE", body["autoResponseMode"])
	}

	// Update auto response mode
	req2, _ := http.NewRequest(http.MethodPatch, ts.URL+"/api/me/auto-response-mode",
		strings.NewReader(`{"mode":"AUTO_APPROVE"}`))
	req2.Header.Set("Remote-User", "alice")
	req2.Header.Set("Content-Type", "application/json")
	resp2, err := http.DefaultClient.Do(req2)
	if err != nil {
		t.Fatalf("PATCH: %v", err)
	}
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("PATCH status = %d", resp2.StatusCode)
	}
	updated := mustJSON(t, resp2)
	if updated["autoResponseMode"] != "AUTO_APPROVE" {
		t.Fatalf("autoResponseMode = %v", updated["autoResponseMode"])
	}
}

func TestApproveRequiresAuth(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	// Create a request first
	payload := []byte(`{"externalId":"x","context":"c","requesterName":"r"}`)
	resp, err := http.DefaultClient.Do(mustReq(t, http.MethodPost, ts.URL+"/api/requests", payload, "test-key"))
	if err != nil {
		t.Fatalf("POST: %v", err)
	}
	created := mustJSON(t, resp)
	id := created["id"].(string)

	// Approve without auth
	req, _ := http.NewRequest(http.MethodPatch, ts.URL+"/api/requests/"+id+"/approve", nil)
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PATCH: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}

	// Approve with forward-auth user
	req, _ = http.NewRequest(http.MethodPatch, ts.URL+"/api/requests/"+id+"/approve", nil)
	req.Header.Set("Remote-User", "bob")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PATCH: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	updated := mustJSON(t, resp)
	if updated["status"] != "APPROVED" {
		t.Fatalf("status = %v", updated["status"])
	}

	// Re-approve should be 409
	req, _ = http.NewRequest(http.MethodPatch, ts.URL+"/api/requests/"+id+"/approve", nil)
	req.Header.Set("Remote-User", "bob")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("PATCH dup: %v", err)
	}
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("dup status = %d, want 409", resp.StatusCode)
	}
}

func TestSubscribeAndUnsubscribe(t *testing.T) {
	ts, cleanup := setupTestServer(t)
	defer cleanup()

	body := strings.NewReader(`{"endpoint":"https://push.example/x","keys":{"p256dh":"p","auth":"a"}}`)
	req, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/me/push/subscribe", body)
	req.Header.Set("Remote-User", "alice")
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("POST sub: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("status = %d, want 201", resp.StatusCode)
	}
	created := mustJSON(t, resp)
	if created["endpoint"] != "https://push.example/x" {
		t.Fatalf("endpoint = %v", created["endpoint"])
	}

	// Same endpoint -> 200 with existing
	body2 := strings.NewReader(`{"endpoint":"https://push.example/x","keys":{"p256dh":"p","auth":"a"}}`)
	req2, _ := http.NewRequest(http.MethodPost, ts.URL+"/api/me/push/subscribe", body2)
	req2.Header.Set("Remote-User", "alice")
	req2.Header.Set("Content-Type", "application/json")
	resp2, err := http.DefaultClient.Do(req2)
	if err != nil {
		t.Fatalf("POST sub dup: %v", err)
	}
	if resp2.StatusCode != http.StatusOK {
		t.Fatalf("dup status = %d, want 200", resp2.StatusCode)
	}

	// Unsubscribe by another user -> 403
	unsub := strings.NewReader(`{"endpoint":"https://push.example/x"}`)
	req3, _ := http.NewRequest(http.MethodDelete, ts.URL+"/api/me/push/unsubscribe", unsub)
	req3.Header.Set("Remote-User", "carol")
	req3.Header.Set("Content-Type", "application/json")
	resp3, err := http.DefaultClient.Do(req3)
	if err != nil {
		t.Fatalf("DELETE: %v", err)
	}
	if resp3.StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", resp3.StatusCode)
	}

	// Unsubscribe by owner -> 200
	unsub2 := strings.NewReader(`{"endpoint":"https://push.example/x"}`)
	req4, _ := http.NewRequest(http.MethodDelete, ts.URL+"/api/me/push/unsubscribe", unsub2)
	req4.Header.Set("Remote-User", "alice")
	req4.Header.Set("Content-Type", "application/json")
	resp4, err := http.DefaultClient.Do(req4)
	if err != nil {
		t.Fatalf("DELETE: %v", err)
	}
	if resp4.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp4.StatusCode)
	}
}

func mustReq(t *testing.T, method, url string, body []byte, apiKey string) *http.Request {
	t.Helper()
	r, err := http.NewRequest(method, url, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("NewRequest: %v", err)
	}
	r.Header.Set("Content-Type", "application/json")
	if apiKey != "" {
		r.Header.Set("x-api-key", apiKey)
	}
	return r
}
