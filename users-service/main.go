package main

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

type AIRequest struct {
	Text string `json:"text"`
}

type AIResponse struct {
	Result string `json:"result"`
	Status string `json:"status"`
}

func main() {
	r := gin.Default()

	// Public API endpoint
	r.POST("/api/process", func(c *gin.Context) {
		var request AIRequest
		if err := c.ShouldBindJSON(&request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// Call internal Python service
		aiResult, err := callAIService(request)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "AI service failed"})
			return
		}

		c.JSON(http.StatusOK, aiResult)
	})

	r.Run(":8080")
}

func callAIService(request AIRequest) (*AIResponse, error) {
	// Get AI service URL from environment variable
	aiServiceURL := os.Getenv("AI_SERVICE_URL")
	if aiServiceURL == "" {
		aiServiceURL = "http://ai-service:8000"
	}

	// Prepare request payload
	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, err
	}

	// Make HTTP request to Python service
	resp, err := http.Post(aiServiceURL+"/process", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Read response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var aiResponse AIResponse
	err = json.Unmarshal(body, &aiResponse)
	if err != nil {
		return nil, err
	}

	return &aiResponse, nil
}
