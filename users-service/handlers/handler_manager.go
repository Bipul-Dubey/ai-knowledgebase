package handlers

import (
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/services"
)

type HandlerManager struct {
	AuthenticationHandler *AuthenticationHandler
	UserHandler           *UserHandler
}

func NewHandlerManager(sm *services.ServiceManager) *HandlerManager {
	return &HandlerManager{
		AuthenticationHandler: NewAuthenticationHandler(sm.AuthenticationService),
		UserHandler:           NewUserHandler(sm.UserService),
	}
}
