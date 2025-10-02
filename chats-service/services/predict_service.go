package services

import (
	"context"
	"database/sql"
	"time"

	"github.com/Bipul-Dubey/ai-knowledgebase/chats-service/config"
	"github.com/Bipul-Dubey/ai-knowledgebase/chats-service/models"
	pb "github.com/Bipul-Dubey/ai-knowledgebase/chats-service/proto"
)

type PredictService interface {
	GetUsersAndPredict(ctx context.Context, input string) (*models.PredictResponse, error)
}

type predictService struct {
	db         *sql.DB
	grpcClient *config.GRPCClient
}

func NewPredictService(db *sql.DB, grpcClient *config.GRPCClient) PredictService {
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
	query := `SELECT id, name, age, email, created_at, updated_at FROM users ORDER BY id`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		err := rows.Scan(&u.ID, &u.Name, &u.Age, &u.Email, &u.CreatedAt, &u.UpdatedAt)
		if err != nil {
			return nil, err
		}
		users = append(users, u)
	}

	return users, rows.Err()
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
