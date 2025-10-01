package main

import (
	"context"
	"net/http"
	"os"
	"time"

	pb "github.com/Bipul-Dubey/ai-knowledgebase/chats-service/proto"

	"github.com/gin-gonic/gin"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
)

type PredictRequest struct {
	Input string `json:"input" binding:"required"`
}

func main() {
	r := gin.Default()
	r.POST("/predict", predictHandler)
	r.Run(":8081") // Listen on port 8081
}

func predictHandler(c *gin.Context) {
	var body PredictRequest

	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	grpcHost := os.Getenv("GRPC_HOST")
	if grpcHost == "" {
		grpcHost = "localhost:50051" // for local development
	}

	// Use grpc.NewClient instead of deprecated grpc.Dial
	conn, err := grpc.NewClient(grpcHost, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to gRPC server"})
		return
	}
	defer conn.Close()

	client := pb.NewInferenceClient(conn)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	res, err := client.Predict(ctx, &pb.PredictRequest{Input: body.Input})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"output": res.Output,
	})
}
