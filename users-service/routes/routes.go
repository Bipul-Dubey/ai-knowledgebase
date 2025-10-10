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
		api.POST("/accept-invite", h.UserHandler.AcceptInviteHandler)
		api.Use(middleware.AuthMiddleware(db))
		{
			api.POST("/invite", middleware.RoleAuthorization(constants.RoleOwner, constants.RoleMaintainer), h.UserHandler.InviteUserHandler)

		}

	}

	return r
}
