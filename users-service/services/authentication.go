package services

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
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
	ResendVerificationEmail(accountID string, email string) error
	AcceptInvite(req models.AcceptInviteRequest) (*models.AcceptInviteResponse, error)
	ForgotPassword(email, accountID string) (interface{}, error)
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

	// 2️⃣ Generate incremental account_id
	var maxAccountID sql.NullString
	if err := tx.Model(&models.Organization{}).Select("MAX(account_id)").Scan(&maxAccountID).Error; err != nil {
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

	accountID := fmt.Sprintf("%016d", lastID+1)

	// 3️⃣ Create organization
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

	// 5️⃣ Generate invite token
	inviteToken, _ := utils.GenerateSecureToken(32)
	expiresAt := time.Now().Add(1 * time.Hour)

	// 6️⃣ Create owner user
	user := models.User{
		ID:             uuid.New(),
		OrganizationID: org.ID,
		Name:           req.OwnerName,
		Email:          req.Email,
		Password:       string(hashedPassword),
		Role:           "owner",
		Status:         "pending",
		InviteToken:    &inviteToken,
		ExpiresAt:      &expiresAt,
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

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	// 8️⃣ Send verification email asynchronously
	go func() {
		frontendURL := os.Getenv("FRONTEND_BASE_URL")
		verifyLink := fmt.Sprintf("%s/verify-account?token=%s&account_id=%s", frontendURL, inviteToken, accountID)

		emailBody := fmt.Sprintf(`
			<h2>Welcome to %s!</h2>
			<p>Hi %s,</p>
			<p>Please verify your account by clicking the button below:</p>
			<a href="%s" style="background:#4F46E5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Verify Account</a>
			<p>This link will expire in 1 hour.</p>
		`, req.OrganizationName, req.OwnerName, verifyLink)

		emailSender := utils.NewEmailSender()
		if err := emailSender.SendEmail(req.Email, "Verify Your Account", emailBody); err != nil {
			fmt.Printf("[WARN] Failed to send verification email: %v\n", err)
		}
	}()

	// 9️⃣ Return response including account_id
	return &models.SignupResponse{
		OrganizationID: org.ID,
		AccountID:      org.AccountID,
		UserID:         user.ID,
		Name:           user.Name,
		Email:          user.Email,
		Role:           user.Role,
		Status:         user.Status,
		InviteToken:    inviteToken,
		ExpiresAt:      &expiresAt,
	}, nil
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
	// 1️⃣ Role-based rules
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

	// 2️⃣ Check if user already exists
	var existing models.User
	if err := s.db.Where("organization_id = ? AND email = ?", orgID, req.Email).First(&existing).Error; err == nil {
		if existing.Status == "active" {
			return nil, errors.New("user already exists and is active")
		}
		return nil, errors.New("user has already been invited")
	}

	// 3️⃣ Generate temporary password
	tempPassword, err := utils.GenerateTempPassword()
	if err != nil {
		return nil, errors.New("failed to create temporary password")
	}
	hashedPassword, _ := bcrypt.GenerateFromPassword([]byte(tempPassword), bcrypt.DefaultCost)

	// 4️⃣ Create invite token
	inviteToken := uuid.NewString()
	expiresAt := time.Now().Add(48 * time.Hour)

	// 5️⃣ Create new user record
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

	// 6️⃣ Fetch inviter name and organization name for email
	var inviter models.User
	s.db.Select("name").Where("id = ?", inviterID).First(&inviter)

	var org models.Organization
	s.db.Select("name, account_id").Where("id = ?", orgID).First(&org)

	// 7️⃣ Send invitation email asynchronously
	frontendURL := os.Getenv("FRONTEND_BASE_URL")
	inviteLink := fmt.Sprintf("%s/accept-invite?token=%s&account_id=%s", frontendURL, inviteToken, org.AccountID)
	go func() {
		emailBody := fmt.Sprintf(`
		<h2>You're invited to join %s!</h2>
		<p>Hi %s,</p>
		<p>%s has invited you to join the organization <strong>%s</strong>.</p>
		<p>Click the button below to accept the invitation and set your password:</p>
		<a href="%s" style="background:#4F46E5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Accept Invitation</a>
		<p>This link will expire in 48 hours.</p>
		<p><strong>Note:</strong> When logging in, please use the following account ID: <code>%s</code></p>
	`, org.Name, newUser.Name, inviter.Name, org.Name, inviteLink, org.AccountID)

		emailSender := utils.NewEmailSender()
		if err := emailSender.SendEmail(newUser.Email, "You're invited to join "+org.Name, emailBody); err != nil {
			fmt.Printf("[WARN] Failed to send invite email: %v\n", err)
		}
	}()

	// 8️⃣ Return response
	return &models.InviteUserResponse{
		UserID:     newUser.ID,
		Email:      newUser.Email,
		Name:       newUser.Name,
		Role:       newUser.Role,
		Status:     newUser.Status,
		ExpiresAt:  newUser.ExpiresAt,
		InviteLink: inviteLink,
	}, nil
}

func (s *authenticationService) AcceptInvite(req models.AcceptInviteRequest) (*models.AcceptInviteResponse, error) {
	var user models.User
	if err := s.db.
		Joins("JOIN organizations o ON o.id = users.organization_id").
		Where("users.email = ? AND users.invite_token = ? AND o.account_id = ?", req.Email, req.Token, req.AccountID).
		First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("invalid invite token or account id")
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

func (s *authenticationService) ResendVerificationEmail(accountID string, email string) error {
	var org models.Organization
	if err := s.db.Where("account_id = ?", accountID).First(&org).Error; err != nil {
		return errors.New("organization not found for this account ID")
	}

	var user models.User
	if err := s.db.
		Where("email = ? AND organization_id = ? AND status = ?", email, org.ID, "pending").
		First(&user).Error; err != nil {
		return errors.New("no pending user found with this email for the given account")
	}

	// Regenerate token if missing or expired
	if user.InviteToken == nil || user.ExpiresAt == nil || time.Now().After(*user.ExpiresAt) {
		token, _ := utils.GenerateSecureToken(32)
		expiresAt := time.Now().Add(1 * time.Hour)
		user.InviteToken = &token
		user.ExpiresAt = &expiresAt
		if err := s.db.Save(&user).Error; err != nil {
			return err
		}
	}

	frontendURL := os.Getenv("FRONTEND_BASE_URL")
	verifyLink := fmt.Sprintf("%s/verify-account?token=%s", frontendURL, *user.InviteToken)

	emailBody := fmt.Sprintf(`
		<h2>Account Verification</h2>
		<p>Hello %s,</p>
		<p>Please verify your account for organization <strong>%s</strong> by clicking below:</p>
		<a href="%s" style="background:#4F46E5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Verify Account</a>
		<p>This link will expire in 1 hour.</p>
	`, user.Name, org.Name, verifyLink)

	emailSender := utils.NewEmailSender()
	return emailSender.SendEmail(user.Email, "Verify Your Account", emailBody)
}

// 🔹 Forgot Password
func (s *authenticationService) ForgotPassword(email, accountID string) (interface{}, error) {
	var user models.User

	// 🔹 Fetch user by email + account ID + active status
	if err := s.db.Joins("JOIN organizations o ON o.id = users.organization_id").
		Where("users.email = ? AND o.account_id = ? AND users.status = ?", email, accountID, "active").
		First(&user).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not registered or inactive in this organization")
		}
		return nil, err
	}

	// 🔹 Generate reset token and expiry
	resetToken := uuid.NewString()
	expiresAt := time.Now().Add(1 * time.Hour)

	// 🔹 Update user with new token
	if err := s.db.Model(&user).Updates(map[string]interface{}{
		"invite_token": resetToken,
		"expires_at":   expiresAt,
	}).Error; err != nil {
		return nil, err
	}

	// 🔹 Prepare reset password link
	frontendURL := os.Getenv("FRONTEND_BASE_URL")
	resetLink := fmt.Sprintf("%s/reset-password?token=%s", frontendURL, resetToken)

	// 🔹 Email content
	subject := "Reset Your Password"
	body := fmt.Sprintf(`
		<h2>Password Reset Request</h2>
		<p>Hello %s,</p>
		<p>We received a request to reset your password. Click below to set a new password:</p>
		<a href="%s" style="background:#4F46E5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Reset Password</a>
		<p>This link will expire in 1 hour. If you didn’t request a password reset, you can safely ignore this email.</p>
	`, user.Name, resetLink)

	// 🔹 Send email using shared util
	emailSender := utils.NewEmailSender()
	if err := emailSender.SendEmail(user.Email, subject, body); err != nil {
		fmt.Printf("⚠️ Failed to send reset email: %v\n", err)
		return nil, errors.New("failed to send reset password email, please try again later")
	}

	// 🔹 Return minimal response
	return gin.H{
		"email":      user.Email,
		"account_id": accountID,
		"message":    "Password reset link sent successfully",
		"expires_at": expiresAt,
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
