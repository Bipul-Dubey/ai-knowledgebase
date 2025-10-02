package models

import "time"

type User struct {
	ID        int       `json:"id"`
	Name      string    `json:"name"`
	Age       int       `json:"age"`
	Email     string    `json:"email"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type PredictRequest struct {
	Input string `json:"input" binding:"required"`
}

type PredictResponse struct {
	Success    bool   `json:"success"`
	Message    string `json:"message"`
	Prediction string `json:"prediction"`
	Users      []User `json:"users"`
	UserCount  int    `json:"user_count"`
	Error      string `json:"error,omitempty"`
}
