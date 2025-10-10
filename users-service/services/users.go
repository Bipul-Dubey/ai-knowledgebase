package services

import (
	"errors"
	"time"

	"github.com/Bipul-Dubey/ai-knowledgebase/shared/models"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type UserService interface {
	InviteUser(inviterID uuid.UUID, inviterRole string, orgID uuid.UUID, req models.InviteUserRequest) (*models.InviteUserResponse, error)
	AcceptInvite(req models.AcceptInviteRequest) (*models.AcceptInviteResponse, error)
}

type userService struct {
	db *gorm.DB
}

func NewUserService(db *gorm.DB) UserService {
	return &userService{db: db}
}

func (s *userService) InviteUser(inviterID uuid.UUID, inviterRole string, orgID uuid.UUID, req models.InviteUserRequest) (*models.InviteUserResponse, error) {
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

func (s *userService) AcceptInvite(req models.AcceptInviteRequest) (*models.AcceptInviteResponse, error) {
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
