package handlers

import (
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/services"
)

type HandlerManager struct {
	AuthenticationHandler *AuthenticationHandler
}

func NewHandlerManager(sm *services.ServiceManager) *HandlerManager {
	return &HandlerManager{
		AuthenticationHandler: NewAuthenticationHandler(sm.AuthenticationService),
	}
}
