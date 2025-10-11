package services

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/Bipul-Dubey/ai-knowledgebase/shared/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OrganizationService interface {
	GetOrganizationDetails(orgID string, role string) (*models.OrganizationDetailsResponse, error)
}
type organizationService struct {
	db *gorm.DB
}

func NewOrganizationService(db *gorm.DB) OrganizationService {
	return &organizationService{db: db}
}

func (s *organizationService) GetOrganizationDetails(orgID, role string) (*models.OrganizationDetailsResponse, error) {
	fmt.Println("orgid:", orgID)
	if orgID == "" {
		return nil, errors.New("organization ID cannot be empty")
	}

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		return nil, errors.New("invalid organization ID")
	}

	var org models.Organization
	if err := s.db.First(&org, "id = ?", orgUUID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("organization not found")
		}
		return nil, err
	}

	// 🧩 Base response
	response := &models.OrganizationDetailsResponse{
		OrganizationID: org.ID.String(),
		Name:           org.Name,
		CreatedAt:      org.CreatedAt,
		Status:         org.Status,
	}

	// Convert AccountID to int64 if stored as string
	if org.AccountID != "" {
		accountIDInt, err := strconv.ParseInt(org.AccountID, 10, 64)
		if err == nil {
			response.AccountID = accountIDInt
		}
	}

	// 👤 Fetch creator details if CreatedBy is not nil
	if org.CreatedBy != nil {
		var creator models.User
		if err := s.db.Select("id, name").
			Where("id = ?", *org.CreatedBy).
			First(&creator).Error; err == nil {
			response.CreatedByUserID = creator.ID.String()
			response.CreatedByUserName = creator.Name
		}
	}

	// 🧠 If not a member, attach additional details
	if role != "member" {
		var totalUsers int64
		if err := s.db.Model(&models.User{}).
			Where("organization_id = ?", org.ID).
			Count(&totalUsers).Error; err != nil {
			return nil, err
		}
		tu := int(totalUsers)
		response.TotalUsers = &tu

		// Get owner email
		var owner models.User
		if err := s.db.Select("email").
			Where("organization_id = ? AND role = ?", org.ID, "owner").
			First(&owner).Error; err == nil && owner.Email != "" {
			response.OwnerEmail = &owner.Email
		}
	}

	return response, nil
}
