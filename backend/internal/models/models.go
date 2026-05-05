package models

import "time"

type AutoResponseMode string

const (
	AutoResponseNone    AutoResponseMode = "NONE"
	AutoResponseApprove AutoResponseMode = "AUTO_APPROVE"
	AutoResponseReject  AutoResponseMode = "AUTO_REJECT"
)

func IsValidAutoResponseMode(s string) bool {
	switch AutoResponseMode(s) {
	case AutoResponseNone, AutoResponseApprove, AutoResponseReject:
		return true
	}
	return false
}

type RequestStatus string

const (
	StatusPending  RequestStatus = "PENDING"
	StatusApproved RequestStatus = "APPROVED"
	StatusRejected RequestStatus = "REJECTED"
	StatusExpired  RequestStatus = "EXPIRED"
)

func IsValidRequestStatus(s string) bool {
	switch RequestStatus(s) {
	case StatusPending, StatusApproved, StatusRejected, StatusExpired:
		return true
	}
	return false
}

type User struct {
	ID               string           `json:"id"`
	Username         string           `json:"username"`
	Email            *string          `json:"email"`
	AutheliaID       string           `json:"autheliaId"`
	DisplayName      string           `json:"displayName"`
	AutoResponseMode AutoResponseMode `json:"autoResponseMode"`
	CreatedAt        time.Time        `json:"createdAt"`
	UpdatedAt        time.Time        `json:"updatedAt"`
}

type Request struct {
	ID             string        `json:"id"`
	ExternalID     string        `json:"externalId"`
	Context        string        `json:"context"`
	RequesterName  string        `json:"requesterName"`
	Status         RequestStatus `json:"status"`
	TimeoutSeconds *int          `json:"timeoutSeconds"`
	ExpiresAt      *time.Time    `json:"expiresAt"`
	CreatedAt      time.Time     `json:"createdAt"`
	UpdatedAt      time.Time     `json:"updatedAt"`
	ProcessedAt    *time.Time    `json:"processedAt"`
	ProcessedByID  *string       `json:"processedById"`
}

type PushSubscription struct {
	ID        string    `json:"id"`
	UserID    string    `json:"userId"`
	Endpoint  string    `json:"endpoint"`
	P256dh    string    `json:"p256dh"`
	Auth      string    `json:"auth"`
	CreatedAt time.Time `json:"createdAt"`
}
