package services

import (
	"errors"
	"strconv"

	"github.com/Bipul-Dubey/ai-knowledgebase/shared/models"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type OrganizationService interface {
	GetOrganizationDetails(orgID string, role string) (*models.OrganizationDetailsResponse, error)
	GetDashboardStats(orgID string, userID string) (*models.DashboardStatsResponse, error)
	DeleteOrganization(orgID string) error
}
type organizationService struct {
	db *gorm.DB
}

func NewOrganizationService(db *gorm.DB) OrganizationService {
	return &organizationService{db: db}
}

func (s *organizationService) GetOrganizationDetails(orgID, role string) (*models.OrganizationDetailsResponse, error) {
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
		Status:         org.Status,
		CreatedAt:      org.CreatedAt,
		UpdatedAt:      org.UpdatedAt,
	}

	// Convert AccountID to int64 if stored as string
	if org.AccountID != "" {
		accountIDInt, err := strconv.ParseInt(org.AccountID, 10, 64)
		if err == nil {
			response.AccountID = accountIDInt
		}
	}

	// 👤 Fetch creator details
	if org.CreatedBy != nil {
		var creator models.User
		if err := s.db.Select("id, name").
			Where("id = ?", *org.CreatedBy).
			First(&creator).Error; err == nil {

			id := creator.ID.String()
			name := creator.Name

			response.CreatedByUserID = &id
			response.CreatedByUserName = &name
		}
	}

	// 🧠 If not member, attach additional details
	if role != "member" {

		// ✅ Total Users
		var totalUsers int64
		if err := s.db.Model(&models.User{}).
			Where("organization_id = ?", org.ID).
			Count(&totalUsers).Error; err != nil {
			return nil, err
		}
		response.TotalUsers = int(totalUsers)

		// ✅ Total Maintainers
		var totalMaintainers int64
		if err := s.db.Model(&models.User{}).
			Where("organization_id = ? AND role = ?", org.ID, "maintainer").
			Count(&totalMaintainers).Error; err != nil {
			return nil, err
		}
		response.TotalMaintainers = int(totalMaintainers)

		// ✅ Total Members
		var totalMembers int64
		if err := s.db.Model(&models.User{}).
			Where("organization_id = ? AND role = ?", org.ID, "member").
			Count(&totalMembers).Error; err != nil {
			return nil, err
		}
		response.TotalMembers = int(totalMembers)

		// ✅ Owner Email
		var owner models.User
		if err := s.db.Select("email").
			Where("organization_id = ? AND role = ?", org.ID, "owner").
			First(&owner).Error; err == nil && owner.Email != "" {

			email := owner.Email
			response.OwnerEmail = &email
		}
	}

	return response, nil
}

func (s *organizationService) GetDashboardStats(orgID string, userID string) (*models.DashboardStatsResponse, error) {

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		return nil, errors.New("invalid organization ID")
	}

	userUUID, err := uuid.Parse(userID)
	if err != nil {
		return nil, errors.New("invalid user ID")
	}

	var stats models.DashboardStatsResponse

	// ------------------------------------------------
	// Organization Name
	// ------------------------------------------------
	if err := s.db.Raw(`
		SELECT name FROM organizations WHERE id = ?
	`, orgUUID).Scan(&stats.OrganizationName).Error; err != nil {
		return nil, err
	}

	// ------------------------------------------------
	// Current User Info
	// ------------------------------------------------
	if err := s.db.Raw(`
		SELECT name, role
		FROM users
		WHERE id = ?
	`, userUUID).Row().Scan(&stats.UserName, &stats.UserRole); err != nil {
		return nil, err
	}

	// ------------------------------------------------
	// USERS
	// ------------------------------------------------
	if err := s.db.Raw(`
		SELECT COUNT(*) 
		FROM users
		WHERE organization_id = ?
	`, orgUUID).Scan(&stats.TotalUsers).Error; err != nil {
		return nil, err
	}

	if err := s.db.Raw(`
		SELECT COUNT(*) 
		FROM users
		WHERE organization_id = ?
		AND is_deleted = false
	`, orgUUID).Scan(&stats.ActiveUsers).Error; err != nil {
		return nil, err
	}

	// ------------------------------------------------
	// DOCUMENTS
	// ------------------------------------------------
	if err := s.db.Raw(`
		SELECT COUNT(*) 
		FROM documents
		WHERE organization_id = ?
	`, orgUUID).Scan(&stats.TotalDocuments).Error; err != nil {
		return nil, err
	}

	if err := s.db.Raw(`
		SELECT COUNT(*) 
		FROM documents
		WHERE organization_id = ?
		AND deleted_at IS NULL
	`, orgUUID).Scan(&stats.ActiveDocuments).Error; err != nil {
		return nil, err
	}

	// ------------------------------------------------
	// CHATS
	// ------------------------------------------------
	if err := s.db.Raw(`
		SELECT COUNT(*) 
		FROM chats
		WHERE organization_id = ?
	`, orgUUID).Scan(&stats.TotalChats).Error; err != nil {
		return nil, err
	}

	if err := s.db.Raw(`
		SELECT COUNT(*) 
		FROM chats
		WHERE organization_id = ?
		AND deleted_at IS NULL
	`, orgUUID).Scan(&stats.ActiveChats).Error; err != nil {
		return nil, err
	}

	// ------------------------------------------------
	// QUERIES
	// ------------------------------------------------
	if err := s.db.Raw(`
		SELECT COUNT(*)
		FROM messages
		WHERE organization_id = ?
		AND role = 'user'
	`, orgUUID).Scan(&stats.TotalQueries).Error; err != nil {
		return nil, err
	}

	// ------------------------------------------------
	// TOTAL MESSAGES
	// ------------------------------------------------
	if err := s.db.Raw(`
		SELECT COUNT(*)
		FROM messages
		WHERE organization_id = ?
	`, orgUUID).Scan(&stats.TotalMessages).Error; err != nil {
		return nil, err
	}

	// ------------------------------------------------
	// TOTAL COST
	// ------------------------------------------------
	if err := s.db.Raw(`
		SELECT COALESCE(SUM(total_cost), 0)
		FROM token_usage
		WHERE organization_id = ?
	`, orgUUID).Scan(&stats.TotalCost).Error; err != nil {
		return nil, err
	}

	// ------------------------------------------------
	// LAST 30 DAYS ACTIVITY
	// ------------------------------------------------
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
				AND deleted_at IS NULL
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

func (s *organizationService) DeleteOrganization(orgID string) error {
	if orgID == "" {
		return errors.New("organization ID cannot be empty")
	}

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		return errors.New("invalid organization ID")
	}

	result := s.db.Delete(&models.Organization{}, "id = ?", orgUUID)

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("organization not found")
	}

	return nil
}

/*
func (s *organizationService) DeleteOrganization(orgID string) error {
	if orgID == "" {
		return errors.New("organization ID cannot be empty")
	}

	orgUUID, err := uuid.Parse(orgID)
	if err != nil {
		return errors.New("invalid organization ID")
	}

	result := s.db.Model(&models.Organization{}).
		Where("id = ?", orgUUID).
		Updates(map[string]interface{}{
			"is_deleted": true,
			"deleted_at": time.Now(),
		})

	if result.Error != nil {
		return result.Error
	}

	if result.RowsAffected == 0 {
		return errors.New("organization not found")
	}

	return nil
}
*/
