package handlers

import (
	"net/http"

	"github.com/Bipul-Dubey/ai-knowledgebase/shared/models"
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/services"
	"github.com/gin-gonic/gin"
)

type AuthenticationHandler struct {
	authService services.AuthenticationService
}

func NewAuthenticationHandler(authService services.AuthenticationService) *AuthenticationHandler {
	return &AuthenticationHandler{authService: authService}
}

// ----------------------
// SignUp Handler
// ----------------------
func (h *AuthenticationHandler) SignUp(c *gin.Context) {
	var req models.SignupRequest

	// Bind JSON body into SignUpRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Call service layer
	res, err := h.authService.SignUp(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "Signup failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "Signup successful",
		"data":    res,
	})
}

func (h *AuthenticationHandler) VerifyAccount(c *gin.Context) {
	var req models.VerifyAccountRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.authService.VerifyAccount(c.Request.Context(), req.Token)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "Verification failed",
			"error":   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Account verified successfully",
		"data":    res,
	})
}

func (h *AuthenticationHandler) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	res, err := h.authService.Login(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Login successful",
		"data":    res,
	})
}
