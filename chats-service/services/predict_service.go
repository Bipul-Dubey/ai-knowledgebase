package services

import (
	"context"
	"time"

	"github.com/Bipul-Dubey/ai-knowledgebase/chats-service/config"
	"github.com/Bipul-Dubey/ai-knowledgebase/chats-service/models"
	pb "github.com/Bipul-Dubey/ai-knowledgebase/chats-service/proto"
	"gorm.io/gorm"
)

type PredictService interface {
	GetUsersAndPredict(ctx context.Context, input string) (*models.PredictResponse, error)
}

type predictService struct {
	db         *gorm.DB
	grpcClient *config.GRPCClient
}

func NewPredictService(db *gorm.DB, grpcClient *config.GRPCClient) PredictService {
	return &predictService{
		db:         db,
		grpcClient: grpcClient,
	}
}

func (s *predictService) GetUsersAndPredict(ctx context.Context, input string) (*models.PredictResponse, error) {
	response := &models.PredictResponse{
		Success: true,
		Message: "Data fetched successfully",
	}

	// Get users from database
	users, err := s.getUsers(ctx)
	if err != nil {
		response.Success = false
		response.Error = "Failed to fetch users: " + err.Error()
		return response, err
	}

	response.Users = users
	response.UserCount = len(users)

	// Get prediction from gRPC
	if s.grpcClient != nil {
		prediction, err := s.makePrediction(ctx, input)
		if err != nil {
			response.Prediction = "AI service unavailable: " + err.Error()
		} else {
			response.Prediction = prediction
		}
	} else {
		response.Prediction = "AI service not connected"
	}

	return response, nil
}

func (s *predictService) getUsers(ctx context.Context) ([]models.User, error) {
	var users []models.User

	// Using GORM raw SQL query (like your previous sql.DB query)
	query := `SELECT id, name, age, email, created_at, updated_at FROM users ORDER BY id`
	if err := s.db.WithContext(ctx).Raw(query).Scan(&users).Error; err != nil {
		return nil, err
	}

	return users, nil
}

func (s *predictService) makePrediction(ctx context.Context, input string) (string, error) {
	client := s.grpcClient.GetClient()

	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	res, err := client.Predict(timeoutCtx, &pb.PredictRequest{Input: input})
	if err != nil {
		return "", err
	}

	return res.Output, nil
}
