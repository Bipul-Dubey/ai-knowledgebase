package services

import (
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/Bipul-Dubey/ai-knowledgebase/shared/models"
	utils "github.com/Bipul-Dubey/ai-knowledgebase/shared/utils"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserService interface {
	InviteUser(inviterID uuid.UUID, inviterRole string, orgID uuid.UUID, req models.InviteUserRequest) (*models.InviteUserResponse, error)
	ResendVerificationEmail(orgID string, userID string) error
	UpdateUserRole(orgID, requestingUserID, requestingRole, targetUserID, newRole string) error
	GetUsersByOrganization(orgID string, query models.UserListQuery) (*models.PaginatedUsersResponse, error)
	GetUserStats(orgID string) (*models.UserStatsResponse, error)
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

// ResendVerificationEmail re-sends an invite to one user. The organization
// is taken from the caller's token, not from the request, so an owner cannot
// reach into another tenant by naming its account id.
func (s *userService) ResendVerificationEmail(orgID string, userID string) error {
	var org models.Organization
	if err := s.db.Where("id = ?", orgID).First(&org).Error; err != nil {
		return errors.New("organization not found")
	}

	var user models.User
	if err := s.db.
		Where("id = ? AND organization_id = ? AND status IN ?", userID, org.ID, []string{"pending", "suspended"}).
		First(&user).Error; err != nil {
		return errors.New("no pending or suspended user found in this organization")
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
// UpdateUserRole promotes or demotes one member.
//
// Owner-only. A maintainer promoting someone to maintainer would be granting
// privileges it does not own, so role changes sit a level above suspension,
// which maintainers may do to members.
func (s *userService) UpdateUserRole(orgID, requestingUserID, requestingRole, targetUserID, newRole string) error {
	if newRole != "maintainer" && newRole != "member" {
		return errors.New("role must be maintainer or member")
	}

	targetUUID, err := uuid.Parse(targetUserID)
	if err != nil {
		return errors.New("invalid target user id")
	}

	if _, err := uuid.Parse(requestingUserID); err != nil {
		return errors.New("invalid requesting user id")
	}

	if requestingRole != "owner" {
		return errors.New("only the owner can change roles")
	}

	// ❌ Cannot change your own role: an owner demoting itself would leave
	// the organization with nobody able to promote anyone back.
	if requestingUserID == targetUserID {
		return errors.New("you cannot change your own role")
	}

	var targetUser models.User
	if err := s.db.
		Where("id = ? AND organization_id = ? AND is_deleted = false", targetUUID, orgID).
		First(&targetUser).Error; err != nil {

		if errors.Is(err, gorm.ErrRecordNotFound) {
			return errors.New("user not found")
		}
		return err
	}

	if targetUser.Role == "owner" {
		return errors.New("the owner's role cannot be changed")
	}

	if targetUser.Role == newRole {
		return nil
	}

	// token_version invalidates every token already issued to this user.
	// RoleAuthorization reads the role out of the JWT and never re-checks
	// the database, so without this a demoted maintainer would keep
	// maintainer access until their token happened to expire.
	return s.db.Model(&models.User{}).
		Where("id = ?", targetUUID).
		Updates(map[string]interface{}{
			"role":          newRole,
			"token_version": gorm.Expr("token_version + 1"),
			"updated_at":    time.Now(),
		}).Error
}

func (s *userService) GetUsersByOrganization(orgID string, query models.UserListQuery) (*models.PaginatedUsersResponse, error) {

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		return nil, errors.New("invalid organization id")
	}

	page := query.Page
	if page < 1 {
		page = 1
	}

	limit := query.Limit
	if limit < 1 {
		limit = 10
	}
	if limit > 100 {
		// Cap it: the page size arrives from the client.
		limit = 100
	}

	base := s.db.Model(&models.User{}).
		Where("organization_id = ? AND is_deleted = false", orgUUID)

	if search := strings.TrimSpace(query.Search); search != "" {
		pattern := "%" + strings.ToLower(search) + "%"
		base = base.Where(
			"LOWER(name) LIKE ? OR LOWER(email) LIKE ?", pattern, pattern,
		)
	}

	// Count before paging, so TotalPages reflects the filter.
	var total int64
	if err := base.Count(&total).Error; err != nil {
		return nil, err
	}

	// Order in SQL, not in the page component: sorting one page client-side
	// would only reorder those ten rows, so the owner would appear "first"
	// on every page.
	var users []models.User
	err = base.
		Order("CASE WHEN role = 'owner' THEN 0 WHEN role = 'maintainer' THEN 1 ELSE 2 END").
		Order("created_at DESC").
		Limit(limit).
		Offset((page - 1) * limit).
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

	totalPages := 0
	if total > 0 {
		totalPages = int((total + int64(limit) - 1) / int64(limit))
	}

	return &models.PaginatedUsersResponse{
		Users:      response,
		Total:      total,
		Page:       page,
		Limit:      limit,
		TotalPages: totalPages,
	}, nil
}

// GetUserStats summarises the organization's membership: how many people,
// how they are split by role and status, and how much they actually use it.
func (s *userService) GetUserStats(orgID string) (*models.UserStatsResponse, error) {
	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		return nil, errors.New("invalid organization id")
	}

	var stats models.UserStatsResponse

	if err := s.db.Raw(`
		SELECT
			COUNT(*),
			COUNT(*) FILTER (WHERE role = 'owner'),
			COUNT(*) FILTER (WHERE role = 'maintainer'),
			COUNT(*) FILTER (WHERE role = 'member'),
			COUNT(*) FILTER (WHERE status = 'active'),
			COUNT(*) FILTER (WHERE status = 'pending'),
			COUNT(*) FILTER (WHERE status = 'suspended')
		FROM users
		WHERE organization_id = ?
		AND is_deleted = false
	`, orgUUID).Row().Scan(
		&stats.TotalUsers,
		&stats.Owners,
		&stats.Maintainers,
		&stats.Members,
		&stats.Active,
		&stats.Pending,
		&stats.Suspended,
	); err != nil {
		return nil, err
	}

	// Adoption: people who asked something recently, not people with a seat.
	if err := s.db.Raw(`
		SELECT COUNT(DISTINCT sender_user_id)
		FROM messages
		WHERE organization_id = ?
		AND role = 'user'
		AND sender_user_id IS NOT NULL
		AND created_at >= CURRENT_DATE - INTERVAL '6 days'
	`, orgUUID).Scan(&stats.ActiveUsers7d).Error; err != nil {
		return nil, err
	}

	if err := s.db.Raw(`
		SELECT COUNT(*)
		FROM messages
		WHERE organization_id = ?
		AND role = 'user'
	`, orgUUID).Scan(&stats.TotalQueries).Error; err != nil {
		return nil, err
	}

	if stats.TotalUsers > 0 {
		stats.AvgQueriesPerUser =
			float64(stats.TotalQueries) / float64(stats.TotalUsers)
	}

	return &stats, nil
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

	// Was checking err a second time, which could never be non-nil here.
	if _, err := uuid.Parse(requestingUserID); err != nil {
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
