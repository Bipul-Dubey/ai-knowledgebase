package routes

import (
	"github.com/Bipul-Dubey/ai-knowledgebase/shared/constants"
	"github.com/Bipul-Dubey/ai-knowledgebase/shared/middleware"
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/handlers"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupRoutes(r *gin.Engine, h *handlers.HandlerManager, db *gorm.DB) *gin.Engine {
	// r := gin.Default()

	api := r.Group("/api/v1")
	{
		api.POST("/signup", h.AuthenticationHandler.SignUp)
		api.POST("/verify-account", h.AuthenticationHandler.VerifyAccount) // verify email if create account by itself
		api.POST("/login", h.AuthenticationHandler.Login)
		api.POST("/accept-invite", h.AuthenticationHandler.AcceptInviteHandler) // accept invite from any organization

		api.POST("/forgot-password", h.AuthenticationHandler.ForgotPassword)
		api.POST("/reset-password-email", h.AuthenticationHandler.ResetPasswordByEmail)
		api.POST("/resend-verification", h.AuthenticationHandler.ResendVerificationEmail)

		// new group with authentication
		auth := api.Group("")
		auth.Use(middleware.AuthMiddleware(db))
		{
			auth.POST("/reset-password", h.AuthenticationHandler.ResetPassword)
			api.POST("users/resend-verification", h.AuthenticationHandler.ResendVerificationEmail)

			// ORGANIZATION
			org := auth.Group("/organization")
			{
				org.GET("/details", h.OrganizationHandler.GetOrganizationDetails)
				org.GET("/dashboard-stats", h.OrganizationHandler.GetDashboardStats)
			}

			// USER
			users := auth.Group("/users")
			{
				users.POST("/invite", middleware.RoleAuthorization(constants.RoleOwner, constants.RoleMaintainer), h.UserHandler.InviteUserHandler)
				users.GET(
					"",
					middleware.RoleAuthorization(constants.RoleOwner, constants.RoleMaintainer),
					h.UserHandler.GetUsersByOrganization,
				)

				users.GET(
					"/:id",
					middleware.RoleAuthorization(constants.RoleOwner, constants.RoleMaintainer),
					h.UserHandler.GetUserByID,
				)
			}

		}

	}

	return r
}
