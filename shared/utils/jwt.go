package utils

import (
	"log"
	"os"
	"sync"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// SigningMethod is the only algorithm this service issues or accepts.
// Pinning it prevents algorithm-confusion attacks, where a forged token
// declares "alg": "none" or an asymmetric algorithm and the verifier is
// tricked into treating the public key (or nothing at all) as the secret.
var SigningMethod = jwt.SigningMethodHS256

const minJWTSecretLen = 32

var (
	jwtSecretOnce sync.Once
	jwtSecret     []byte
)

// JWTSecret returns the HMAC signing key from the JWT_SECRET environment
// variable, resolved once and cached.
//
// There is deliberately no default. A fallback key would be identical across
// every checkout and deployment, so anyone who had seen the source could mint
// valid tokens for any user in any organization. The process exits instead, so
// the misconfiguration cannot go unnoticed.
//
// chats-service (Python) must be given the identical value, or tokens issued
// here are rejected there. Generate one with: openssl rand -hex 48
func JWTSecret() []byte {
	jwtSecretOnce.Do(func() {
		secret := os.Getenv("JWT_SECRET")
		if secret == "" {
			log.Fatal("JWT_SECRET is not set - refusing to start. Generate one with: openssl rand -hex 48")
		}
		if len(secret) < minJWTSecretLen {
			log.Fatalf("JWT_SECRET must be at least %d characters, got %d - refusing to start.", minJWTSecretLen, len(secret))
		}
		jwtSecret = []byte(secret)
	})
	return jwtSecret
}

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

	token := jwt.NewWithClaims(SigningMethod, claims)
	return token.SignedString(JWTSecret())
}
