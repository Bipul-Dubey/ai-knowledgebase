package handlers

import (
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/services"
)

// UserHandler handles user-related endpoints
type UserHandler struct {
	userService services.UserService
}

func NewUserHandler(userService services.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}
