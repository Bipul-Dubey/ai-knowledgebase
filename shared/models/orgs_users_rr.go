package models

import (
	"time"

	"github.com/google/uuid"
)

type SignupRequest struct {
	OrganizationName string `json:"organization_name" validate:"required"`
	OwnerName        string `json:"owner_name" validate:"required"`
	Email            string `json:"email" validate:"required,email"`
	Password         string `json:"password" validate:"required,min=8"`
}

type SignupResponse struct {
	OrganizationID uuid.UUID `json:"organization_id"`
	AccountID      string    `json:"account_id"`
	UserID         uuid.UUID `json:"user_id"`
	Name           string    `json:"name"`
	Email          string    `json:"email"`
	Role           string    `json:"role"`
	Status         string    `json:"status"`
	// ⚡️ Send verification mail to Email
	// TODO: temp use until email feature implemented
	InviteToken string     `json:"invite_token"`         // for verification email
	ExpiresAt   *time.Time `json:"expires_at,omitempty"` // token expiry
}

type LoginRequest struct {
	Email     string `json:"email" validate:"required,email"`
	Password  string `json:"password" validate:"required"`
	AccountID string `json:"account_id" validate:"required"` // organization login ID
}

type LoginResponse struct {
	AccessToken      string    `json:"access_token"`
	UserID           uuid.UUID `json:"user_id"`
	OrganizationID   uuid.UUID `json:"organization_id"`
	Role             string    `json:"role"`
	Name             string    `json:"name"`
	Email            string    `json:"email"`
	Status           string    `json:"status"`
	OrganizationName string    `json:"organization_name"`
}

type VerifyAccountRequest struct {
	Token string `json:"token" validate:"required"`
}

type VerifyAccountResponse struct {
	UserID         uuid.UUID `json:"user_id"`
	Email          string    `json:"email"`
	Status         string    `json:"status"`
	IsVerified     bool      `json:"is_verified"`
	OrganizationID uuid.UUID `json:"organization_id"`
	// ⚡️ Triggered by clicking verification link from email
}

type InviteUserRequest struct {
	Email string `json:"email" validate:"required,email"`
	Role  string `json:"role" validate:"required,oneof=maintainer member"`
	Name  string `json:"name"`
}

type InviteUserResponse struct {
	UserID     uuid.UUID  `json:"user_id"`
	Email      string     `json:"email"`
	Name       string     `json:"name"`
	Role       string     `json:"role"`
	Status     string     `json:"status"`
	ExpiresAt  *time.Time `json:"expires_at"`
	InviteLink string     `json:"invite_link"`
	// ⚡️ Send invite email to Email with InviteToken link
}

type AcceptInviteRequest struct {
	Name      string `json:"name" binding:"required"`
	Email     string `json:"email" binding:"required,email"`
	Password  string `json:"password" binding:"required,min=6"`
	AccountID string `json:"account_id" binding:"required"`
	Token     string `json:"token" binding:"required"`
}

type AcceptInviteResponse struct {
	UserID         uuid.UUID `json:"user_id"`
	Name           string    `json:"name"`
	Email          string    `json:"email"`
	OrganizationID uuid.UUID `json:"organization_id"`
	Role           string    `json:"role"`
	Status         string    `json:"status"`
	IsVerified     bool      `json:"is_verified"`
}

type ResetPasswordRequest struct {
	OldPassword string `json:"old_password" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

type ResetPasswordByEmailRequest struct {
	Token       string `json:"token" binding:"required"`
	NewPassword string `json:"new_password" binding:"required,min=8"`
}

type OrganizationDetailsResponse struct {
	OrganizationID    string    `json:"organization_id"`
	AccountID         int64     `json:"account_id"`
	Name              string    `json:"name"`
	Status            string    `json:"status"`
	CreatedAt         time.Time `json:"created_at"`
	TotalUsers        *int      `json:"total_users,omitempty"`
	OwnerEmail        *string   `json:"owner_email,omitempty"`
	CreatedByUserID   string    `json:"created_by_user_id,omitempty"`
	CreatedByUserName string    `json:"created_by_user_name,omitempty"`
}

type AccountVerificationRequest struct {
	AccountID string `json:"account_id" binding:"required"`
	Email     string `json:"email" binding:"required,email"`
}
