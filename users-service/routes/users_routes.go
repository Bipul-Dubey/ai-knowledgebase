package routes

import (
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/handlers"
	"github.com/gin-gonic/gin"
)

func SetupRoutes(userHandler *handlers.UserHandler) *gin.Engine {
	r := gin.Default()

	api := r.Group("/api/v1")
	{
		users := api.Group("/users")
		{
			users.GET("", userHandler.GetUsers)
		}
	}

	return r
}
