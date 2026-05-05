package util

import "github.com/lucsky/cuid"

func NewID() string {
	return cuid.New()
}
