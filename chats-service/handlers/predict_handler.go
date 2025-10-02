package handlers

import (
	"net/http"

	"github.com/Bipul-Dubey/ai-knowledgebase/chats-service/models"
	"github.com/Bipul-Dubey/ai-knowledgebase/chats-service/services"
	"github.com/gin-gonic/gin"
)

type PredictHandler struct {
	predictService services.PredictService
}

func NewPredictHandler(predictService services.PredictService) *PredictHandler {
	return &PredictHandler{
		predictService: predictService,
	}
}

// Single API - returns users list + gRPC prediction
func (h *PredictHandler) Predict(c *gin.Context) {
	var req models.PredictRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.PredictResponse{
			Success: false,
			Message: "Invalid request data",
			Error:   err.Error(),
		})
		return
	}

	response, err := h.predictService.GetUsersAndPredict(c.Request.Context(), req.Input)
	if err != nil && !response.Success {
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	c.JSON(http.StatusOK, response)
}
