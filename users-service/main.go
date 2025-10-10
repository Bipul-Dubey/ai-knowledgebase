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

	sqlDB, err := database.DB()
	if err != nil {
		log.Fatal("Failed to retrieve underlying SQL DB:", err)
	}
	defer func() {
		if cerr := sqlDB.Close(); cerr != nil {
			log.Printf("Error closing database: %v", cerr)
		}
	}()

	// Initialize service layer
	serviceManager := services.NewServiceManager(database)

	// Initialize handler layer
	handlerManager := handlers.NewHandlerManager(serviceManager)

	// Setup routes
	r := routes.SetupRoutes(handlerManager, database)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("🚀 Users Service starting on port %s", port)
	log.Fatal(r.Run(":" + port))
}
