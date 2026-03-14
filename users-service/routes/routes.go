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

		// new group with authentication
		auth := api.Group("")
		auth.Use(middleware.AuthMiddleware(db))
		{
			auth.POST("/reset-password", h.AuthenticationHandler.ResetPassword)

			// ORGANIZATION
			org := auth.Group("/organization")
			{
				org.GET("/details", h.OrganizationHandler.GetOrganizationDetails)
				org.GET("/dashboard-stats", h.OrganizationHandler.GetDashboardStats)
				org.DELETE("", h.OrganizationHandler.DeleteOrganization)
			}

			// USER
			users := auth.Group("/users")
			{
				users.POST("/invite", middleware.RoleAuthorization(constants.RoleOwner, constants.RoleMaintainer), h.UserHandler.InviteUserHandler)
				users.POST("/resend-verification", middleware.RoleAuthorization(constants.RoleOwner, constants.RoleMaintainer), h.UserHandler.ResendVerificationEmail)

				users.GET(
					"",
					middleware.RoleAuthorization(constants.RoleOwner, constants.RoleMaintainer),
					h.UserHandler.GetUsersByOrganization,
				)

				users.GET(
					"/me",
					h.UserHandler.GetCurrentUser,
				)

				users.GET(
					"/:id",
					middleware.RoleAuthorization(constants.RoleOwner, constants.RoleMaintainer),
					h.UserHandler.GetUserByID,
				)

				users.PATCH("/:id/suspend", middleware.RoleAuthorization(constants.RoleOwner, constants.RoleMaintainer), h.UserHandler.SuspendUser)
				users.DELETE("/:id", middleware.RoleAuthorization(constants.RoleOwner, constants.RoleMaintainer), h.UserHandler.DeleteUser)
			}

		}

	}

	return r
}
