package utils

import (
	"net/http"
)

// GenericResponse structure
type GenericResponse struct {
	Error   bool        `json:"error"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
	Status  int         `json:"status"`
}

// NewResponse creates a generic response.
// If errorFlag=true → returns error response (status required or default 400)
// If errorFlag=false → returns success response (status optional, default 200)
func APIResponse(errorFlag bool, message string, data interface{}, status ...int) GenericResponse {
	code := http.StatusOK
	if len(status) > 0 {
		code = status[0]
	} else if errorFlag {
		code = http.StatusBadRequest
	}

	return GenericResponse{
		Error:   errorFlag,
		Message: message,
		Data:    data,
		Status:  code,
	}
}
