package routes

import (
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
		// api.POST("/invite", h.InviteUser)
		// api.POST("/accept-invite", h.AcceptInvite)

		// api.Use(middleware.AuthMiddleware(db))
		// {
		// 	api.GET("/profile", func(c *gin.Context) {
		// 		claims, _ := c.Get("userClaims")
		// 		c.JSON(200, gin.H{"user": claims})
		// 	})
		// }
	}

	return r
}
