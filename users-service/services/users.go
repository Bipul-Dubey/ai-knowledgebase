package services

import (
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/Bipul-Dubey/ai-knowledgebase/shared/models"
	utils "github.com/Bipul-Dubey/ai-knowledgebase/shared/utils"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserService interface {
	InviteUser(inviterID uuid.UUID, inviterRole string, orgID uuid.UUID, req models.InviteUserRequest) (*models.InviteUserResponse, error)
	ResendVerificationEmail(accountID string, email string) error
	GetUsersByOrganization(orgID string) ([]models.UserResponse, error)
	GetUserByID(orgID, userID string) (*models.UserResponse, error)
	DeleteUser(orgID, requestingUserID, requestingRole, targetUserID string) error
	SuspendUser(orgID, requestingUserID, requestingRole, targetUserID string) error
}

type userService struct {
	db *gorm.DB
}

func NewUserService(db *gorm.DB) UserService {
	return &userService{db: db}
}

func (s *userService) InviteUser(inviterID uuid.UUID, inviterRole string, orgID uuid.UUID, req models.InviteUserRequest) (*models.InviteUserResponse, error) {
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
	inviteLink := fmt.Sprintf("%s/pl/accept-invite?token=%s&account_id=%s", frontendURL, inviteToken, org.AccountID)
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

func (s *userService) ResendVerificationEmail(accountID string, email string) error {
	var org models.Organization
	if err := s.db.Where("account_id = ?", accountID).First(&org).Error; err != nil {
		return errors.New("organization not found for this account ID")
	}

	var user models.User
	if err := s.db.
		Where("email = ? AND organization_id = ? AND status IN ?", email, org.ID, []string{"pending", "suspended"}).
		First(&user).Error; err != nil {
		return errors.New("no pending or suspended user found with this email for the given account")
	}

	// If suspended, reset back to pending so they can re-verify
	wasSuspended := user.Status == "suspended"

	// Always regenerate a fresh token
	token, _ := utils.GenerateSecureToken(32)
	expiresAt := time.Now().Add(1 * time.Hour)
	user.InviteToken = &token
	user.ExpiresAt = &expiresAt
	if wasSuspended {
		user.Status = "pending"
	}
	if err := s.db.Save(&user).Error; err != nil {
		return err
	}

	frontendURL := os.Getenv("FRONTEND_BASE_URL")
	verifyLink := fmt.Sprintf("%s/pl/verify-account?token=%s", frontendURL, token)

	var emailSubject, emailBody string
	if wasSuspended {
		emailSubject = "Your account has been re-invited"
		emailBody = fmt.Sprintf(`
		<h2>You've been re-invited to %s</h2>
		<p>Hello %s,</p>
		<p>Your account was previously suspended. An admin has re-invited you to <strong>%s</strong>.</p>
		<p>Click below to verify your account and set a new password:</p>
		<a href="%s" style="background:#4F46E5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Accept Re-invite</a>
		<p>This link will expire in 1 hour.</p>
	`, org.Name, user.Name, org.Name, verifyLink)
	} else {
		emailSubject = "Verify Your Account"
		emailBody = fmt.Sprintf(`
		<h2>Account Verification</h2>
		<p>Hello %s,</p>
		<p>Please verify your account for organization <strong>%s</strong> by clicking below:</p>
		<a href="%s" style="background:#4F46E5;color:white;padding:10px 20px;border-radius:6px;text-decoration:none;">Verify Account</a>
		<p>This link will expire in 1 hour.</p>
	`, user.Name, org.Name, verifyLink)
	}

	emailSender := utils.NewEmailSender()
	return emailSender.SendEmail(user.Email, emailSubject, emailBody)
}

// ==============================
// Get Users by Organization
// ==============================
func (s *userService) GetUsersByOrganization(orgID string) ([]models.UserResponse, error) {

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		return nil, errors.New("invalid organization id")
	}

	var users []models.User

	err = s.db.
		Where("organization_id = ? AND is_deleted = false", orgUUID).
		Order("created_at DESC").
		Find(&users).Error

	if err != nil {
		return nil, err
	}

	// Convert to response
	var response []models.UserResponse
	for _, u := range users {
		response = append(response, models.UserResponse{
			ID:             u.ID,
			OrganizationID: u.OrganizationID,
			Name:           u.Name,
			Email:          u.Email,
			Role:           u.Role,
			Status:         u.Status,
			InvitedBy:      u.InvitedBy,
			ExpiresAt:      u.ExpiresAt,
			ReactivatedAt:  u.ReactivatedAt,
			CreatedAt:      u.CreatedAt,
			UpdatedAt:      u.UpdatedAt,
		})
	}

	return response, nil
}

// ==============================
// Get User By ID
// ==============================
func (s *userService) GetUserByID(orgID, userID string) (*models.UserResponse, error) {

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user id")
	}

	var user models.User

	err = s.db.
		Where("organization_id = ? AND id = ? AND is_deleted = false", orgID, userUUID).
		First(&user).Error

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	response := models.UserResponse{
		ID:             user.ID,
		OrganizationID: user.OrganizationID,
		Name:           user.Name,
		Email:          user.Email,
		Role:           user.Role,
		Status:         user.Status,
		InvitedBy:      user.InvitedBy,
		ExpiresAt:      user.ExpiresAt,
		ReactivatedAt:  user.ReactivatedAt,
		CreatedAt:      user.CreatedAt,
		UpdatedAt:      user.UpdatedAt,
	}

	return &response, nil
}

func (s *userService) DeleteUser(orgID, requestingUserID, requestingRole, targetUserID string) error {
	if targetUserID == "" {
		return errors.New("target user id required")
	}

	targetUUID, err := uuid.Parse(targetUserID)
	if err != nil {
		return errors.New("invalid target user id")
	}

	var targetUser models.User
	if err := s.db.
		Where("id = ? AND organization_id = ?", targetUUID, orgID).
		First(&targetUser).Error; err != nil {

		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("user not found")
		}
		return err
	}

	// ❌ Cannot delete yourself
	if requestingUserID == targetUserID {
		return errors.New("you cannot delete yourself")
	}

	// ❌ Owner cannot be deleted
	if targetUser.Role == "owner" {
		return errors.New("owner cannot be deleted")
	}

	// 🔐 RBAC Rules
	switch requestingRole {

	case "owner":
		// Owner can delete maintainer & member
		if targetUser.Role == "maintainer" || targetUser.Role == "member" {
			break
		}
		return errors.New("not authorized to delete this user")

	case "maintainer":
		// Maintainer can only delete member
		if targetUser.Role == "member" {
			break
		}
		return errors.New("not authorized to delete this user")

	default:
		return errors.New("not authorized to delete users")
	}

	// ✅ Soft delete recommended
	err = s.db.Model(&models.User{}).
		Where("id = ?", targetUUID).
		Updates(map[string]interface{}{
			"is_deleted": true,
			"deleted_at": time.Now(),
			"deleted_by": requestingUserID,
		}).Error

	return err
}

func (s *userService) SuspendUser(orgID, requestingUserID, requestingRole, targetUserID string) error {
	if targetUserID == "" {
		return errors.New("target user id required")
	}

	targetUUID, err := uuid.Parse(targetUserID)
	if err != nil {
		return errors.New("invalid target user id")
	}

	if err != nil {
		return errors.New("invalid requesting user id")
	}

	var targetUser models.User
	if err := s.db.
		Where("id = ? AND organization_id = ?", targetUUID, orgID).
		First(&targetUser).Error; err != nil {

		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("user not found")
		}
		return err
	}

	// ❌ Cannot suspend yourself
	if requestingUserID == targetUserID {
		return errors.New("you cannot suspend yourself")
	}

	// ❌ Owner cannot be suspended
	if targetUser.Role == "owner" {
		return errors.New("owner cannot be suspended")
	}

	// 🔐 RBAC Rules
	switch requestingRole {

	case "owner":
		if targetUser.Role != "maintainer" && targetUser.Role != "member" {
			return errors.New("not authorized to suspend this user")
		}

	case "maintainer":
		if targetUser.Role != "member" {
			return errors.New("not authorized to suspend this user")
		}

	default:
		return errors.New("not authorized to suspend users")
	}

	// ❌ Already suspended
	if targetUser.Status == "suspended" {
		return errors.New("user already suspended")
	}

	// ✅ Suspend
	return s.db.Model(&models.User{}).
		Where("id = ?", targetUUID).
		Updates(map[string]interface{}{
			"status": "suspended",
		}).Error
}
