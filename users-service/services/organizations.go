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
	GetDashboardStats(orgID string) (*models.DashboardStatsResponse, error)
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

func (s *organizationService) GetDashboardStats(orgID string) (*models.DashboardStatsResponse, error) {
	if orgID == "" {
		return nil, errors.New("organization ID cannot be empty")
	}

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		return nil, errors.New("invalid organization ID")
	}

	var stats models.DashboardStatsResponse

	// Total Users
	if err := s.db.Raw(`
		SELECT COUNT(*)
		FROM users
		WHERE organization_id = ?
		AND is_deleted = false
	`, orgUUID).Scan(&stats.TotalUsers).Error; err != nil {
		return nil, err
	}

	// Total Documents
	if err := s.db.Raw(`
		SELECT COUNT(*)
		FROM documents
		WHERE organization_id = ?
	`, orgUUID).Scan(&stats.TotalDocuments).Error; err != nil {
		return nil, err
	}

	// Total Chats
	if err := s.db.Raw(`
		SELECT COUNT(*)
		FROM chats
		WHERE organization_id = ?
	`, orgUUID).Scan(&stats.TotalChats).Error; err != nil {
		return nil, err
	}

	// Total Queries
	if err := s.db.Raw(`
		SELECT COUNT(*)
		FROM messages
		WHERE organization_id = ?
		AND role = 'user'
	`, orgUUID).Scan(&stats.TotalQueries).Error; err != nil {
		return nil, err
	}

	// Total Messages
	if err := s.db.Raw(`
		SELECT COUNT(*)
		FROM messages
		WHERE organization_id = ?
	`, orgUUID).Scan(&stats.TotalMessages).Error; err != nil {
		return nil, err
	}

	// Total Cost
	if err := s.db.Raw(`
		SELECT COALESCE(SUM(total_cost), 0)
		FROM token_usage
		WHERE organization_id = ?
	`, orgUUID).Scan(&stats.TotalCost).Error; err != nil {
		return nil, err
	}

	// Last 30 Days Activity
	var activity []models.DailyActivity

	chartQuery := `
				SELECT
					d.date::date AS date,
					COALESCE(c.total_chats, 0) AS total_chats,
					COALESCE(m.total_messages, 0) AS total_messages
				FROM
					generate_series(
						CURRENT_DATE - INTERVAL '29 days',
						CURRENT_DATE,
						INTERVAL '1 day'
					) AS d(date)
				LEFT JOIN (
					SELECT DATE(created_at) AS date, COUNT(*) AS total_chats
					FROM chats
					WHERE organization_id = ?
					AND created_at >= CURRENT_DATE - INTERVAL '30 days'
					GROUP BY DATE(created_at)
				) c ON c.date = d.date
				LEFT JOIN (
					SELECT DATE(created_at) AS date, COUNT(*) AS total_messages
					FROM messages
					WHERE organization_id = ?
					AND created_at >= CURRENT_DATE - INTERVAL '30 days'
					GROUP BY DATE(created_at)
				) m ON m.date = d.date
				ORDER BY d.date;
				`

	if err := s.db.Raw(chartQuery, orgUUID, orgUUID).
		Scan(&activity).Error; err != nil {
		return nil, err
	}

	stats.Last30Days = activity

	return &stats, nil
}
