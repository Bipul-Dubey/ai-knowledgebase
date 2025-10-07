package routes

import (
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/handlers"
	"github.com/gin-gonic/gin"
)

func SetupRoutes(h *handlers.HandlerManager) *gin.Engine {
	r := gin.Default()

	api := r.Group("/api/v1")
	{
		api.POST("/signup", h.AuthenticationHandler.SignUp)
		api.POST("/verify-account", h.AuthenticationHandler.VerifyAccount)
		// api.POST("/login", h.Login)
		// api.POST("/invite", h.InviteUser)
		// api.POST("/accept-invite", h.AcceptInvite)
	}

	return r
}
