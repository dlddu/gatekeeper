package util

import "time"

// DBTime formats a time.Time as the ISO 8601 string format that Prisma's
// SQLite driver writes (millisecond precision, UTC, "Z" suffix).
//
// Without this, modernc.org/sqlite serializes time.Time via its default
// "2006-01-02 15:04:05.999999999 -0700 MST" form, which Prisma then fails
// to parse and surfaces as null. Use DBTime for every time.Time passed
// into SQL Exec/Query parameters.
func DBTime(t time.Time) string {
	return t.UTC().Format("2006-01-02T15:04:05.000Z")
}
