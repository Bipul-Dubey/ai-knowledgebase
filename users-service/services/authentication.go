package services

import (
	"context"

	"github.com/Bipul-Dubey/ai-knowledgebase/chats-service/models"
	"gorm.io/gorm"
)

type AuthenticationService interface {
	GetUsersAndPredict(ctx context.Context, input string) (*models.PredictResponse, error)
}

type authenticationService struct {
	db *gorm.DB
}

func NewAuthenticationService(db *gorm.DB) AuthenticationService {
	return &authenticationService{
		db: db,
	}
}

func (h *authenticationService) GetUsersAndPredict(ctx context.Context, input string) (*models.PredictResponse, error) {
	var count int64
	if err := h.db.Raw("SELECT COUNT(*) FROM users").Scan(&count).Error; err != nil {
		return nil, err
	}

	// TODO: implement your prediction logic here
	return &models.PredictResponse{
		Message: "Prediction feature not implemented yet",
	}, nil
}
