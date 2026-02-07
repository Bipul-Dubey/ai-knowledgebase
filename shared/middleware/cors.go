package middleware

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func CORSMiddleware() gin.HandlerFunc {
	origins := os.Getenv("CORS_ORIGINS")
	fmt.Println("origins :", origins)
	if origins == "" {
		origins = "http://localhost:3000,http://localhost:8080"
	}
	allowed := strings.Split(origins, ",")

	return cors.New(cors.Config{
		AllowOriginFunc: func(origin string) bool {
			for _, o := range allowed {
				if origin == o {
					return true
				}
			}
			return false
		},

		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	})
}
