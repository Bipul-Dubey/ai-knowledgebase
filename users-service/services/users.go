package services

import (
	"gorm.io/gorm"
)

type UserService interface {
}

type userService struct {
	db *gorm.DB
}

func NewUserService(db *gorm.DB) UserService {
	return &userService{db: db}
}
