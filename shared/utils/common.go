package utils

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
)

func GenerateSecureToken(n int) (string, error) {
	bytes := make([]byte, n)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(bytes), nil
}

func GenerateTempPassword() (string, error) {
	bytes := make([]byte, 8) // 8 bytes = 16 hex chars
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return hex.EncodeToString(bytes), nil
}
