package main

import (
	"log"
	"os"

	"github.com/Bipul-Dubey/ai-knowledgebase/shared/db"
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/handlers"
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/routes"
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/services"
)

func main() {
	// Initialize database
	database, err := db.NewDB()
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}
	defer database.Close()

	// Initialize service with direct *sql.DB
	userService := services.NewUserService(database)

	// Initialize handler
	userHandler := handlers.NewUserHandler(userService)

	// Setup routes
	r := routes.SetupRoutes(userHandler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Users Service starting on port %s", port)
	log.Fatal(r.Run(":" + port))
}
