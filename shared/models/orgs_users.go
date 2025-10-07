package models

import (
	"time"

	"github.com/google/uuid"
)

// ===============================
// Organization
// ===============================
type Organization struct {
	ID        uuid.UUID  `gorm:"type:uuid;primaryKey"`
	Name      string     `gorm:"type:varchar(255);not null"`
	AccountID string     `gorm:"type:varchar(16);unique;not null"`
	CreatedBy *uuid.UUID `gorm:"type:uuid"`
	Status    string     `gorm:"type:varchar(20);default:'pending'"` // pending / active
	CreatedAt time.Time  `gorm:"default:now()"`
	UpdatedAt time.Time  `gorm:"default:now()"`
}

// ===============================
// User
// ===============================
type User struct {
	ID             uuid.UUID  `gorm:"type:uuid;primaryKey"`
	OrganizationID uuid.UUID  `gorm:"type:uuid;not null;index"`
	Name           string     `gorm:"type:varchar(255);not null"`
	Email          string     `gorm:"type:varchar(255);not null"`         // unique per org
	Password       string     `gorm:"type:varchar(255)"`                  // hashed
	Role           string     `gorm:"type:varchar(20);not null"`          // owner / maintainer / member
	Status         string     `gorm:"type:varchar(20);default:'pending'"` // pending / active / suspended
	InvitedBy      *uuid.UUID `gorm:"type:uuid"`
	InviteToken    *string    `gorm:"type:varchar(255)"`
	ExpiresAt      *time.Time
	ReactivatedAt  *time.Time
	CreatedAt      time.Time `gorm:"default:now()"`
	UpdatedAt      time.Time `gorm:"default:now()"`
	IsDeleted      bool      `gorm:"default:false"`
	DeletedAt      *time.Time
	DeletedBy      *uuid.UUID

	// ⚡️ Send email on invite (InviteToken)
	// ⚡️ Send email on verify (InviteToken)
	// ⚡️ Return this model (without Password, InviteToken) in API responses
}
