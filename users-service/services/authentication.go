package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/Bipul-Dubey/ai-knowledgebase/shared/models"
	utils "github.com/Bipul-Dubey/ai-knowledgebase/shared/utils"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthenticationService interface {
	SignUp(ctx context.Context, req *models.SignupRequest) (*models.SignupResponse, error)
	VerifyAccount(ctx context.Context, token string) (*models.VerifyAccountResponse, error)
	// Login(ctx context.Context, req *models.LoginRequest) (*models.LoginResponse, error)
	// InviteUser(ctx context.Context, req *models.InviteUserRequest) (*models.InviteUserResponse, error)
	// AcceptInvite(ctx context.Context, req *models.AcceptInviteRequest) (*models.AcceptInviteResponse, error)
}
type authenticationService struct {
	db *gorm.DB
}

func NewAuthenticationService(db *gorm.DB) AuthenticationService {
	return &authenticationService{db: db}
}

// ======
// SignUp
// ======
func (s *authenticationService) SignUp(ctx context.Context, req *models.SignupRequest) (*models.SignupResponse, error) {
	// Start transaction
	tx := s.db.WithContext(ctx).Begin()
	if tx.Error != nil {
		return nil, tx.Error
	}

	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// 1️⃣ Check if organization with same name exists
	var existingOrg models.Organization
	if err := tx.Where("name = ?", req.OrganizationName).First(&existingOrg).Error; err == nil {
		tx.Rollback()
		return nil, errors.New("organization with this name already exists")
	}

	// 2️⃣ Generate incremental account_id as string
	var maxAccountID sql.NullString
	if err := tx.Model(&models.Organization{}).
		Select("MAX(account_id)").
		Scan(&maxAccountID).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("failed to fetch max account ID: %w", err)
	}

	var lastID int64
	if maxAccountID.Valid && maxAccountID.String != "" {
		parsedID, parseErr := strconv.ParseInt(maxAccountID.String, 10, 64)
		if parseErr != nil {
			tx.Rollback()
			return nil, fmt.Errorf("failed to parse last account ID: %w", parseErr)
		}
		lastID = parsedID
	} else {
		lastID = 1100000000000000
	}

	nextID := lastID + 1
	accountID := fmt.Sprintf("%016d", nextID)

	// 3️⃣ Create organization (CreatedBy will be set later)
	org := models.Organization{
		ID:        uuid.New(),
		Name:      req.OrganizationName,
		AccountID: accountID,
		Status:    "pending",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	if err := tx.Create(&org).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 4️⃣ Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	// 5️⃣ Generate secure invite token
	inviteToken, err := utils.GenerateSecureToken(32) // implement in utils
	if err != nil {
		tx.Rollback()
		return nil, err
	}
	expiresAt := time.Now().Add(48 * time.Hour)

	// 6️⃣ Create owner user
	user := models.User{
		ID:             uuid.New(),
		OrganizationID: org.ID,
		Name:           req.OwnerName,
		Email:          req.Email,
		Password:       string(hashedPassword),
		Role:           "owner",
		Status:         "pending",    // pending until verification
		InviteToken:    &inviteToken, // pointer
		ExpiresAt:      &expiresAt,   // pointer
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}
	if err := tx.Create(&user).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 7️⃣ Update organization CreatedBy
	org.CreatedBy = &user.ID
	if err := tx.Save(&org).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	// 8️⃣ Commit transaction
	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	// ⚡️ TODO: send verification email with encrypted inviteToken

	res := &models.SignupResponse{
		OrganizationID: org.ID,
		AccountID:      org.AccountID,
		UserID:         user.ID,
		Name:           user.Name,
		Email:          user.Email,
		Role:           user.Role,
		Status:         user.Status,
		InviteToken:    inviteToken,
		ExpiresAt:      &expiresAt,
	}
	return res, nil
}

// ======
// VerifyAccount
// ======
func (s *authenticationService) VerifyAccount(ctx context.Context, token string) (*models.VerifyAccountResponse, error) {
	var user models.User

	// 1️⃣ Find user by invite token
	if err := s.db.WithContext(ctx).
		Where("invite_token = ?", token).
		First(&user).Error; err != nil {
		return nil, fmt.Errorf("invalid token")
	}

	// 2️⃣ Check if already verified
	if user.Status == "active" {
		return nil, fmt.Errorf("account already verified")
	}

	// 3️⃣ Check if token expired
	if user.ExpiresAt != nil && time.Now().After(*user.ExpiresAt) {
		return nil, fmt.Errorf("token has expired")
	}

	// 4️⃣ Update user status to active and clear token
	user.Status = "active"
	user.InviteToken = nil
	user.ExpiresAt = nil
	user.UpdatedAt = time.Now()
	if err := s.db.Save(&user).Error; err != nil {
		return nil, err
	}

	// 5️⃣ If user is owner, activate organization
	if user.Role == "owner" {
		var org models.Organization
		if err := s.db.First(&org, "id = ?", user.OrganizationID).Error; err != nil {
			return nil, fmt.Errorf("organization not found")
		}
		org.Status = "active"
		org.UpdatedAt = time.Now()
		if err := s.db.Save(&org).Error; err != nil {
			return nil, err
		}
	}

	// 6️⃣ Prepare response
	res := &models.VerifyAccountResponse{
		UserID:         user.ID,
		Email:          user.Email,
		Status:         user.Status,
		IsVerified:     true,
		OrganizationID: user.OrganizationID,
	}

	return res, nil
}
