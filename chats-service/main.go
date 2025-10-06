package main

import (
	"log"
	"os"

	"github.com/Bipul-Dubey/ai-knowledgebase/chats-service/config"
	"github.com/Bipul-Dubey/ai-knowledgebase/chats-service/handlers"
	"github.com/Bipul-Dubey/ai-knowledgebase/chats-service/routes"
	"github.com/Bipul-Dubey/ai-knowledgebase/chats-service/services"
	"github.com/Bipul-Dubey/ai-knowledgebase/shared/db"
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
			log.Printf("Error closing DB connection: %v", cerr)
		}
	}()

	// Initialize gRPC client (optional)
	grpcClient, err := config.NewGRPCClient()
	if err != nil {
		log.Printf("Warning: gRPC service unavailable: %v", err)
		grpcClient = nil
	} else {
		defer grpcClient.Close()
	}

	// Create service manager with all dependencies
	serviceManager := services.NewServiceManager(database, grpcClient)

	// Create handler manager with service manager
	handlerManager := handlers.NewHandlerManager(serviceManager)

	// Setup routes
	r := routes.SetupRoutes(handlerManager)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8081"
	}

	log.Printf("🚀 Prediction Service starting on port %s", port)
	log.Fatal(r.Run(":" + port))
}
