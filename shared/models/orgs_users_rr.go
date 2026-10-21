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
	UpdatedAt         time.Time `json:"updated_at"`
	TotalUsers        int       `json:"total_users"`
	TotalMaintainers  int       `json:"total_maintainers"`
	TotalMembers      int       `json:"total_members"`
	OwnerEmail        *string   `json:"owner_email,omitempty"`
	CreatedByUserID   *string   `json:"created_by_user_id,omitempty"`
	CreatedByUserName *string   `json:"created_by_user_name,omitempty"`
}

// UserListQuery is the paging and filtering the users list accepts.
// Search runs in the database alongside paging: filtering only the current
// page client-side would silently hide matches on other pages.
type UserListQuery struct {
	Page   int
	Limit  int
	Search string
}

type PaginatedUsersResponse struct {
	Users      []UserResponse `json:"users"`
	Total      int64          `json:"total"`
	Page       int            `json:"page"`
	Limit      int            `json:"limit"`
	TotalPages int            `json:"total_pages"`
}

// UserStatsResponse summarises membership and how much it is actually used.
type UserStatsResponse struct {
	TotalUsers int64 `json:"total_users"`

	Owners      int64 `json:"owners"`
	Maintainers int64 `json:"maintainers"`
	Members     int64 `json:"members"`

	Active    int64 `json:"active"`
	Pending   int64 `json:"pending"`
	Suspended int64 `json:"suspended"`

	// Distinct people who asked something in the last 7 days, which is
	// adoption rather than seats.
	ActiveUsers7d int64 `json:"active_users_7d"`

	TotalQueries      int64   `json:"total_queries"`
	AvgQueriesPerUser float64 `json:"avg_queries_per_user"`
}

// UpdateUserRoleRequest changes one member's role. "owner" is deliberately
// not accepted: transferring ownership is a different operation with
// different consequences.
type UpdateUserRoleRequest struct {
	Role string `json:"role" binding:"required,oneof=maintainer member"`
}

type AccountVerificationRequest struct {
	AccountID string `json:"account_id" binding:"required"`
	Email     string `json:"email" binding:"required,email"`
}

type DailyActivity struct {
	Date          string `json:"date"`
	TotalChats    int64  `json:"total_chats"`
	TotalMessages int64  `json:"total_messages"`
}

type DashboardStatsResponse struct {
	OrganizationName string `json:"organization_name"`
	UserName         string `json:"user_name"`
	UserRole         string `json:"user_role"`

	// Users
	TotalUsers  int64 `json:"total_users"`
	ActiveUsers int64 `json:"active_users"`

	// Documents
	TotalDocuments  int64 `json:"total_documents"`
	ActiveDocuments int64 `json:"active_documents"`

	// Chats
	TotalChats  int64 `json:"total_chats"`
	ActiveChats int64 `json:"active_chats"`

	// Messages
	TotalQueries  int64 `json:"total_queries"`
	TotalMessages int64 `json:"total_messages"`

	// Index health. A document counted in ActiveDocuments is not necessarily
	// searchable: only 'trained' ones are.
	DocumentsTrained   int64 `json:"documents_trained"`
	DocumentsTraining  int64 `json:"documents_training"`
	DocumentsUntrained int64 `json:"documents_untrained"`
	DocumentsFailed    int64 `json:"documents_failed"`

	// What the assistant actually knows. A document count says nothing about
	// size: one manual and one memo both count as 1.
	TotalChunks  int64 `json:"total_chunks"`
	IndexedPages int64 `json:"indexed_pages"`
	StorageBytes int64 `json:"storage_bytes"`

	// Answer quality: the share of questions the corpus could answer.
	AnsweredQueries   int64   `json:"answered_queries"`
	UnansweredQueries int64   `json:"unanswered_queries"`
	AnswerRate        float64 `json:"answer_rate"`

	// Engagement, as distinct from seats: ActiveUsers counts people who are
	// not suspended, this counts people who actually asked something.
	ActiveUsers30d int64 `json:"active_users_30d"`

	// Load. Self-hosted inference has no per-token cost, so tokens rather
	// than spend are the number worth watching.
	TotalPromptTokens     int64 `json:"total_prompt_tokens"`
	TotalCompletionTokens int64 `json:"total_completion_tokens"`

	UnansweredQuestions []UnansweredQuestion `json:"unanswered_questions"`
	TopDocuments        []DocumentUsage      `json:"top_documents"`

	Last30Days []DailyActivity `json:"last_30_days"`
}

// UnansweredQuestion is a question the corpus could not answer: the content
// roadmap, in the users' own words.
type UnansweredQuestion struct {
	Question string    `json:"question"`
	AskedAt  time.Time `json:"asked_at"`
}

// DocumentUsage counts how often a document was cited in an answer. Built
// from messages.sources, so it only covers answers given after that column
// was added.
type DocumentUsage struct {
	Title     string `json:"title"`
	Citations int64  `json:"citations"`
}

type UserResponse struct {
	ID             uuid.UUID  `json:"id"`
	OrganizationID uuid.UUID  `json:"organization_id"`
	Name           string     `json:"name"`
	Email          string     `json:"email"`
	Role           string     `json:"role"`
	Status         string     `json:"status"`
	InvitedBy      *uuid.UUID `json:"invited_by,omitempty"`
	ExpiresAt      *time.Time `json:"expires_at,omitempty"`
	ReactivatedAt  *time.Time `json:"reactivated_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}
