package handlers

import (
	"context"
	"time"
)

// backgroundContextWithTimeout returns a fresh context derived from
// context.Background() so async work outlives the original HTTP request.
func backgroundContextWithTimeout(d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), d)
}
