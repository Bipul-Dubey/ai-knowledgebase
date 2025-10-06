package routes

import (
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/handlers"
	"github.com/gin-gonic/gin"
)

func SetupRoutes(hm *handlers.HandlerManager) *gin.Engine {
	r := gin.Default()

	api := r.Group("/api/v1")
	{
		users := api.Group("/users")
		{
			users.POST("", hm.AuthenticationHandler.GetUsersAndPredict)
		}
	}

	return r
}
