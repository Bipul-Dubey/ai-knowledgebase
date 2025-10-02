package handlers

import (
	"github.com/Bipul-Dubey/ai-knowledgebase/chats-service/services"
)

type HandlerManager struct {
	PredictHandler *PredictHandler
	// Add more handlers here later: UserHandler, ChatHandler, etc.
}

func NewHandlerManager(sm *services.ServiceManager) *HandlerManager {
	return &HandlerManager{
		PredictHandler: NewPredictHandler(sm.PredictService),
		// Add more handlers here when needed
	}
}
