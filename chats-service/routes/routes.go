package routes

import (
	"github.com/Bipul-Dubey/ai-knowledgebase/chats-service/handlers"
	"github.com/gin-gonic/gin"
)

func SetupRoutes(hm *handlers.HandlerManager) *gin.Engine {
	r := gin.Default()

	// Single API - returns users + gRPC prediction
	r.POST("/predict", hm.PredictHandler.Predict)

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "chats",
		})
	})

	return r
}
