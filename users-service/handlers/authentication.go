package handlers

import (
	"net/http"

	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/services"
	"github.com/gin-gonic/gin"
)

type AuthenticationHandler struct {
	authService services.AuthenticationService
}

func NewAuthenticationHandler(authService services.AuthenticationService) *AuthenticationHandler {
	return &AuthenticationHandler{authService: authService}
}

func (h *AuthenticationHandler) GetUsersAndPredict(c *gin.Context) {
	input := c.Query("input") // for example, get input from query param
	_, err := h.authService.GetUsersAndPredict(c.Request.Context(), input)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Prediction failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Prediction successful",
		"data":    input + "Predicted result",
	})
}
