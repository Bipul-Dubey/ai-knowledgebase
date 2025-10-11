package models

import "net/http"

type GenericResponse struct {
	Error   bool        `json:"error"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
	Status  int         `json:"status"`
}

// ✅ Success response — optional custom status
func SuccessResponse(message string, data interface{}, status ...int) GenericResponse {
	code := http.StatusOK
	if len(status) > 0 {
		code = status[0]
	}

	return GenericResponse{
		Error:   false,
		Message: message,
		Data:    data,
		Status:  code,
	}
}

// ❌ Error response — must specify status
func ErrorResponse(status int, message string, data interface{}) GenericResponse {
	return GenericResponse{
		Error:   true,
		Message: message,
		Data:    data,
		Status:  status,
	}
}
