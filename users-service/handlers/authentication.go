package handlers

import (
	"net/http"

	"github.com/Bipul-Dubey/ai-knowledgebase/shared/models"
	"github.com/Bipul-Dubey/ai-knowledgebase/shared/utils"
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
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

// InviteUserHandler invites a new user
func (h *AuthenticationHandler) InviteUserHandler(c *gin.Context) {
	// 🔹 Get current user info from middleware
	claims, exists := c.Get("userClaims")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userClaims := claims.(*utils.JWTClaims)

	var req models.InviteUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 🔹 Call service
	resp, err := h.authService.InviteUser(
		uuid.MustParse(userClaims.UserID),
		userClaims.Role,
		uuid.MustParse(userClaims.OrganizationID),
		req,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// AcceptInviteHandler accepts an invitation
func (h *AuthenticationHandler) AcceptInviteHandler(c *gin.Context) {
	var req models.AcceptInviteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	resp, err := h.authService.AcceptInvite(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

// 🔹 Forgot Password
func (h *AuthenticationHandler) ForgotPassword(c *gin.Context) {
	var req models.ForgotPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse(http.StatusBadRequest, "Invalid request payload", nil))
		return
	}

	resp, err := h.authService.ForgotPassword(req.Email)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse(http.StatusBadRequest, err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse("Password reset link sent to your email", resp))
}

// 🔹 Reset Password
func (h *AuthenticationHandler) ResetPassword(c *gin.Context) {
	var req models.ResetPasswordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse(http.StatusBadRequest, "Invalid request payload", nil))
		return
	}

	claims, _ := c.Get("userClaims")

	resp, err := h.authService.ResetPassword(claims, req.OldPassword, req.NewPassword)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse(http.StatusBadRequest, err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse("Password updated successfully", resp))
}

func (h *AuthenticationHandler) ResetPasswordByEmail(c *gin.Context) {
	var req models.ResetPasswordByEmailRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse(http.StatusBadRequest, "Invalid request payload", nil))
		return
	}

	resp, err := h.authService.ResetPasswordByEmail(req.Token, req.NewPassword)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse(http.StatusBadRequest, err.Error(), nil))
		return
	}

	c.JSON(http.StatusOK, models.SuccessResponse("Password reset successfully", resp))
}
