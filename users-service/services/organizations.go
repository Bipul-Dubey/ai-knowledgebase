package services

import (
	"errors"
	"strconv"

	"github.com/Bipul-Dubey/ai-knowledgebase/shared/constants"
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
		AND status = 'active'
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
	// INDEX HEALTH
	// ------------------------------------------------
	// Only 'trained' documents are searchable, so a plain document count can
	// hide a failed index.
	if err := s.db.Raw(`
		SELECT
			COUNT(*) FILTER (WHERE status = 'trained'),
			COUNT(*) FILTER (WHERE status = 'training'),
			COUNT(*) FILTER (WHERE status = 'untrained'),
			COUNT(*) FILTER (WHERE status = 'failed')
		FROM documents
		WHERE organization_id = ?
		AND deleted_at IS NULL
	`, orgUUID).Row().Scan(
		&stats.DocumentsTrained,
		&stats.DocumentsTraining,
		&stats.DocumentsUntrained,
		&stats.DocumentsFailed,
	); err != nil {
		return nil, err
	}

	// ------------------------------------------------
	// KNOWLEDGE BASE SIZE
	// ------------------------------------------------
	if err := s.db.Raw(`
		SELECT
			COUNT(*),
			COUNT(DISTINCT (dc.document_id, dc.page))
		FROM document_chunks dc
		JOIN documents d ON d.id = dc.document_id
		WHERE d.organization_id = ?
		AND d.deleted_at IS NULL
	`, orgUUID).Row().Scan(&stats.TotalChunks, &stats.IndexedPages); err != nil {
		return nil, err
	}

	if err := s.db.Raw(`
		SELECT COALESCE(SUM(file_size), 0)
		FROM documents
		WHERE organization_id = ?
		AND deleted_at IS NULL
	`, orgUUID).Scan(&stats.StorageBytes).Error; err != nil {
		return nil, err
	}

	// ------------------------------------------------
	// ANSWER QUALITY
	// ------------------------------------------------
	// The pipeline writes one fixed sentence when the corpus cannot answer,
	// so counting it gives the answer rate with no extra instrumentation.
	if err := s.db.Raw(`
		SELECT
			COUNT(*) FILTER (WHERE content <> ?),
			COUNT(*) FILTER (WHERE content = ?)
		FROM messages
		WHERE organization_id = ?
		AND role = 'assistant'
	`, constants.NotFoundAnswer, constants.NotFoundAnswer, orgUUID).
		Row().Scan(&stats.AnsweredQueries, &stats.UnansweredQueries); err != nil {
		return nil, err
	}

	if total := stats.AnsweredQueries + stats.UnansweredQueries; total > 0 {
		stats.AnswerRate = float64(stats.AnsweredQueries) / float64(total) * 100
	}

	// ------------------------------------------------
	// ENGAGEMENT
	// ------------------------------------------------
	// People who actually asked something, as opposed to people with a seat.
	if err := s.db.Raw(`
		SELECT COUNT(DISTINCT sender_user_id)
		FROM messages
		WHERE organization_id = ?
		AND role = 'user'
		AND sender_user_id IS NOT NULL
		AND created_at >= CURRENT_DATE - INTERVAL '29 days'
	`, orgUUID).Scan(&stats.ActiveUsers30d).Error; err != nil {
		return nil, err
	}

	// ------------------------------------------------
	// TOKEN THROUGHPUT
	// ------------------------------------------------
	if err := s.db.Raw(`
		SELECT
			COALESCE(SUM(total_prompt_tokens), 0),
			COALESCE(SUM(total_completion_tokens), 0)
		FROM token_usage
		WHERE organization_id = ?
	`, orgUUID).Row().Scan(
		&stats.TotalPromptTokens,
		&stats.TotalCompletionTokens,
	); err != nil {
		return nil, err
	}

	// ------------------------------------------------
	// UNANSWERED QUESTIONS
	// ------------------------------------------------
	// Pair each refusal with the question that produced it: the most recent
	// user message in the same chat before it.
	if err := s.db.Raw(`
		SELECT q.content AS question, a.created_at AS asked_at
		FROM messages a
		JOIN LATERAL (
			SELECT u.content
			FROM messages u
			WHERE u.chat_id = a.chat_id
			AND u.role = 'user'
			AND u.created_at < a.created_at
			ORDER BY u.created_at DESC
			LIMIT 1
		) q ON TRUE
		WHERE a.organization_id = ?
		AND a.role = 'assistant'
		AND a.content = ?
		ORDER BY a.created_at DESC
		LIMIT 10
	`, orgUUID, constants.NotFoundAnswer).Scan(&stats.UnansweredQuestions).Error; err != nil {
		return nil, err
	}

	// ------------------------------------------------
	// MOST CITED DOCUMENTS
	// ------------------------------------------------
	// Read from messages.sources, so this only covers answers produced after
	// that column was added; older rows hold NULL and contribute nothing.
	if err := s.db.Raw(`
		SELECT s->>'title' AS title, COUNT(*) AS citations
		FROM messages m, jsonb_array_elements(m.sources) s
		WHERE m.organization_id = ?
		AND m.sources IS NOT NULL
		GROUP BY 1
		ORDER BY citations DESC, title ASC
		LIMIT 5
	`, orgUUID).Scan(&stats.TopDocuments).Error; err != nil {
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
