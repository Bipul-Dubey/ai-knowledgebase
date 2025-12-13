package routes

import (
	"github.com/Bipul-Dubey/ai-knowledgebase/shared/constants"
	"github.com/Bipul-Dubey/ai-knowledgebase/shared/middleware"
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/handlers"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupRoutes(h *handlers.HandlerManager, db *gorm.DB) *gin.Engine {
	r := gin.Default()

	api := r.Group("/api/v1")
	{
		api.POST("/signup", h.AuthenticationHandler.SignUp)
		api.POST("/verify-account", h.AuthenticationHandler.VerifyAccount)
		api.POST("/login", h.AuthenticationHandler.Login)
		api.POST("/accept-invite", h.AuthenticationHandler.AcceptInviteHandler)
		api.POST("/forgot-password", h.AuthenticationHandler.ForgotPassword)
		api.POST("/reset-password-email", h.AuthenticationHandler.ResetPasswordByEmail)
		api.POST("/resend-verification", h.AuthenticationHandler.ResendVerificationEmail)

		// new group with authentication
		auth := api.Group("")
		auth.Use(middleware.AuthMiddleware(db))
		{
			auth.POST("/invite", middleware.RoleAuthorization(constants.RoleOwner, constants.RoleMaintainer), h.AuthenticationHandler.InviteUserHandler)
			auth.POST("/reset-password", h.AuthenticationHandler.ResetPassword)
			api.POST("users/resend-verification", h.AuthenticationHandler.ResendVerificationEmail)
			auth.GET("/organization/details", h.OrganizationHandler.GetOrganizationDetails)
		}

	}

	return r
}
