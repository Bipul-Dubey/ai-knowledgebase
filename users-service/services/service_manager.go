package services

import (
	"gorm.io/gorm"
)

type ServiceManager struct {
	AuthenticationService AuthenticationService
	UserService           UserService
	OrganizationService   OrganizationService
}

func NewServiceManager(db *gorm.DB) *ServiceManager {
	return &ServiceManager{
		AuthenticationService: NewAuthenticationService(db),
		UserService:           NewUserService(db),
		OrganizationService:   NewOrganizationService(db),
	}
}
