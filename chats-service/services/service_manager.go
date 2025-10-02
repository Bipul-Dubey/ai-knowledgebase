package services

import (
	"database/sql"

	"github.com/Bipul-Dubey/ai-knowledgebase/chats-service/config"
)

type ServiceManager struct {
	PredictService PredictService
	// Add more services here later: UserService, ChatService, etc.
}

func NewServiceManager(db *sql.DB, grpcClient *config.GRPCClient) *ServiceManager {
	return &ServiceManager{
		PredictService: NewPredictService(db, grpcClient),
		// Add more services here when needed
	}
}
