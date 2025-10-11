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
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type AuthenticationService interface {
	SignUp(ctx context.Context, req *models.SignupRequest) (*models.SignupResponse, error)
	VerifyAccount(ctx context.Context, token string) (*models.VerifyAccountResponse, error)
	Login(ctx context.Context, req *models.LoginRequest) (*models.LoginResponse, error)
	InviteUser(inviterID uuid.UUID, inviterRole string, orgID uuid.UUID, req models.InviteUserRequest) (*models.InviteUserResponse, error)
	AcceptInvite(req models.AcceptInviteRequest) (*models.AcceptInviteResponse, error)
	ForgotPassword(email string) (interface{}, error)
	ResetPassword(claims any, oldPassword, newPassword string) (interface{}, error)
	ResetPasswordByEmail(token string, newPassword string) (interface{}, error)
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

func (s *authenticationService) Login(ctx context.Context, req *models.LoginRequest) (*models.LoginResponse, error) {
	// 1️⃣ Find organization by account_id (BIGINT)
	var org models.Organization
	if err := s.db.Where("account_id = ?", req.AccountID).First(&org).Error; err != nil {
		return nil, errors.New("organization not found")
	}

	// 2️⃣ Find user by email + organization_id
	var user models.User
	if err := s.db.Where("email = ? AND organization_id = ?", req.Email, org.ID).First(&user).Error; err != nil {
		return nil, errors.New("invalid credentials")
	}

	// 3️⃣ Check if user is active
	if user.Status != "active" {
		return nil, errors.New("user is not active")
	}

	// 4️⃣ Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(req.Password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	jwtUser := utils.JWTUser{
		UserID:         user.ID.String(),
		OrganizationID: user.OrganizationID.String(),
		AccountID:      org.AccountID,
		Role:           user.Role,
		TokenVersion:   user.TokenVersion,
	}

	token, err := utils.GenerateJWT(jwtUser)
	if err != nil {
		return nil, errors.New("failed to generate access token")
	}

	// 7️⃣ Prepare response with org info
	return &models.LoginResponse{
		AccessToken:      token,
		UserID:           user.ID,
		OrganizationID:   user.OrganizationID,
		Role:             user.Role,
		Name:             user.Name,
		Email:            user.Email,
		Status:           user.Status,
		OrganizationName: org.Name,
	}, nil
}

func (s *authenticationService) InviteUser(inviterID uuid.UUID, inviterRole string, orgID uuid.UUID, req models.InviteUserRequest) (*models.InviteUserResponse, error) {
	// Role-based rules
	switch inviterRole {
	case "owner":
		if req.Role != "maintainer" && req.Role != "member" {
			return nil, errors.New("owner can invite only maintainer or member")
		}
	case "maintainer":
		if req.Role != "member" {
			return nil, errors.New("maintainer can invite only member")
		}
	default:
		return nil, errors.New("members cannot invite users")
	}

	// Check if user already exists
	var existing models.User
	if err := s.db.Where("organization_id = ? AND email = ?", orgID, req.Email).First(&existing).Error; err == nil {
		if existing.Status == "active" {
			return nil, errors.New("user already exists and is active")
		}
		return nil, errors.New("user has already been invited")
	}

	tempPassword, err := utils.GenerateTempPassword()
	if err != nil {
		return nil, errors.New("failed to create account:pass")
	}

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)

	// Create invite token
	inviteToken := uuid.NewString()
	expiresAt := time.Now().Add(48 * time.Hour)

	newUser := &models.User{
		ID:             uuid.New(),
		OrganizationID: orgID,
		Name:           req.Name,
		Email:          req.Email,
		Role:           req.Role,
		Status:         "pending",
		InvitedBy:      &inviterID,
		InviteToken:    &inviteToken,
		ExpiresAt:      &expiresAt,
		Password:       string(hashedPassword),
	}

	if err := s.db.Create(newUser).Error; err != nil {
		return nil, err
	}

	return &models.InviteUserResponse{
		UserID:         newUser.ID,
		Email:          newUser.Email,
		Name:           newUser.Name,
		Role:           newUser.Role,
		Status:         newUser.Status,
		InviteToken:    *newUser.InviteToken,
		ExpiresAt:      newUser.ExpiresAt,
		InvitedBy:      inviterID,
		OrganizationID: orgID,
	}, nil
}

func (s *authenticationService) AcceptInvite(req models.AcceptInviteRequest) (*models.AcceptInviteResponse, error) {
	var user models.User
	if err := s.db.Where("invite_token = ?", req.Token).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid invite token")
		}
		return nil, err
	}

	if user.ExpiresAt != nil && user.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("invite token has expired")
	}

	if user.Status == "active" {
		return nil, errors.New("user already active, no need to accept invite")
	}

	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return nil, errors.New("failed to hash password")
	}

	user.Name = req.Name
	user.Password = string(hashedPassword)
	user.Status = "active"
	user.InviteToken = nil
	user.ExpiresAt = nil
	user.UpdatedAt = time.Now()

	if err := s.db.Save(&user).Error; err != nil {
		return nil, err
	}

	return &models.AcceptInviteResponse{
		UserID:         user.ID,
		Name:           user.Name,
		Email:          user.Email,
		OrganizationID: user.OrganizationID,
		Role:           user.Role,
		Status:         user.Status,
		IsVerified:     true,
	}, nil
}

// 🔹 Forgot Password
func (s *authenticationService) ForgotPassword(email string) (interface{}, error) {
	var user models.User
	if err := s.db.Where("email = ? AND status = ?", email, "active").First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not registered or inactive")
		}
		return nil, err
	}

	resetToken := uuid.NewString()
	expiresAt := time.Now().Add(1 * time.Hour)

	if err := s.db.Model(&user).Updates(map[string]interface{}{
		"invite_token": resetToken,
		"expires_at":   expiresAt,
	}).Error; err != nil {
		return nil, err
	}

	// 💌 You can send resetToken via email here
	return gin.H{
		"email":       user.Email,
		"reset_token": resetToken,
		"expires_at":  expiresAt,
	}, nil
}

// 🔹 Reset Password
func (s *authenticationService) ResetPassword(claims any, oldPassword, newPassword string) (interface{}, error) {
	userClaims := claims.(*utils.JWTClaims)

	var user models.User
	if err := s.db.First(&user, "id = ?", userClaims.UserID).Error; err != nil {
		return nil, errors.New("user not found")
	}

	if user.Status != "active" {
		return nil, errors.New("user is not active")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(oldPassword)); err != nil {
		return nil, errors.New("old password is incorrect")
	}

	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	user.Password = string(hashedPassword)
	user.TokenVersion += 1

	if err := s.db.Save(&user).Error; err != nil {
		return nil, err
	}

	return gin.H{
		"user_id":  user.ID,
		"email":    user.Email,
		"role":     user.Role,
		"status":   user.Status,
		"verified": true,
	}, nil
}

func (s *authenticationService) ResetPasswordByEmail(token string, newPassword string) (interface{}, error) {
	var user models.User
	if err := s.db.Where("invite_token = ?", token).First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid or expired reset link")
		}
		return nil, err
	}

	// ⏰ Check token expiry
	if user.ExpiresAt.Before(time.Now()) {
		return nil, errors.New("reset link expired")
	}

	// 🧩 Hash new password
	hashed, _ := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	user.Password = string(hashed)
	user.Status = "active"
	user.TokenVersion += 1
	user.InviteToken = nil
	user.ExpiresAt = nil

	if err := s.db.Save(&user).Error; err != nil {
		return nil, err
	}

	return gin.H{
		"user_id":  user.ID,
		"email":    user.Email,
		"status":   user.Status,
		"verified": true,
	}, nil
}
