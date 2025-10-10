package utils

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

var jwtSecret = []byte("YOUR_SUPER_SECRET_KEY")

type JWTUser struct {
	UserID         string
	OrganizationID string
	AccountID      string
	Role           string
	TokenVersion   int
}

type JWTClaims struct {
	UserID         string `json:"user_id"`
	OrganizationID string `json:"organization_id"`
	AccountID      string `json:"account_id"`
	Role           string `json:"role"`
	TokenVersion   int    `json:"token_version"`
	jwt.RegisteredClaims
}

func GenerateJWT(u JWTUser) (string, error) {
	claims := JWTClaims{
		UserID:         u.UserID,
		OrganizationID: u.OrganizationID,
		AccountID:      u.AccountID,
		Role:           u.Role,
		TokenVersion:   u.TokenVersion,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}
