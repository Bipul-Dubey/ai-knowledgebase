package handlers

import (
	"net/http"

	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/models"
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/services"
	"github.com/gin-gonic/gin"
)

type UserHandler struct {
	userService *services.UserService
}

func NewUserHandler(userService *services.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

func (h *UserHandler) GetUsers(c *gin.Context) {
	var users []models.User
	var err error

	users, err = h.userService.GetAllUsers(c.Request.Context())

	if err != nil {
		c.JSON(http.StatusInternalServerError, models.UserResponse{
			Success: false,
			Message: "Failed to fetch users",
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.UserResponse{
		Success: true,
		Message: "Users fetched successfully",
		Data:    users,
	})
}
