package services

import (
	"gorm.io/gorm"
)

type ServiceManager struct {
	AuthenticationService AuthenticationService
}

func NewServiceManager(db *gorm.DB) *ServiceManager {
	return &ServiceManager{
		AuthenticationService: NewAuthenticationService(db),
	}
}
