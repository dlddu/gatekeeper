package handlers

import (
	"errors"
	"io/fs"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// StaticHandler serves the Next.js static export bundle from rootDir.
//
// Lookup rules (first match wins):
//  1. exact file:                rootDir + URL.Path
//  2. directory index:           rootDir + URL.Path + "/index.html"
//  3. ".html" extension:         rootDir + URL.Path + ".html"
//  4. /requests/{id} fallback:   rootDir + "/requests/_placeholder/index.html"
//  5. 404 fallback:              rootDir + "/404.html"
//
// /sw.js gets aggressive no-cache headers so service worker updates are picked
// up immediately, mirroring the Cache-Control rule that lived in the Next.js
// `headers()` config before the migration to static export.
func StaticHandler(rootDir string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		urlPath := r.URL.Path

		if file, ok := lookupStaticFile(rootDir, urlPath); ok {
			serveFile(w, r, file)
			return
		}

		// Dynamic route fallback: /requests/<anything>/ → placeholder shell.
		if strings.HasPrefix(urlPath, "/requests/") && urlPath != "/requests" {
			fallback := filepath.Join(rootDir, "requests", "_placeholder", "index.html")
			if _, err := os.Stat(fallback); err == nil {
				serveFile(w, r, fallback)
				return
			}
		}

		// SPA-style 404 page when present.
		if file, ok := lookupStaticFile(rootDir, "/404.html"); ok {
			body, err := os.ReadFile(file)
			if err == nil {
				w.Header().Set("Content-Type", "text/html; charset=utf-8")
				w.WriteHeader(http.StatusNotFound)
				_, _ = w.Write(body)
				return
			}
		}

		http.NotFound(w, r)
	})
}

func lookupStaticFile(rootDir, urlPath string) (string, bool) {
	cleaned := path.Clean("/" + urlPath)
	if strings.Contains(cleaned, "..") {
		return "", false
	}

	candidates := []string{
		filepath.Join(rootDir, cleaned),
		filepath.Join(rootDir, cleaned, "index.html"),
		filepath.Join(rootDir, cleaned+".html"),
	}

	for _, candidate := range candidates {
		info, err := os.Stat(candidate)
		if errors.Is(err, fs.ErrNotExist) {
			continue
		}
		if err != nil {
			continue
		}
		if info.IsDir() {
			continue
		}
		return candidate, true
	}
	return "", false
}

func serveFile(w http.ResponseWriter, r *http.Request, file string) {
	if filepath.Base(file) == "sw.js" {
		w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
		w.Header().Set("Service-Worker-Allowed", "/")
	}
	http.ServeFile(w, r, file)
}
