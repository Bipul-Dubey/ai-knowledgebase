package middleware

import (
	"errors"
	"net/http"
	"strings"

	"github.com/Bipul-Dubey/ai-knowledgebase/shared/models"
	"github.com/Bipul-Dubey/ai-knowledgebase/shared/utils"
	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"gorm.io/gorm"
)

var jwtSecret = []byte("YOUR_SUPER_SECRET_KEY")

func AuthMiddleware(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing Authorization header"})
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenStr == authHeader {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid Authorization header format"})
			return
		}

		claims, err := validateJWT(tokenStr, db)
		if err != nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
			return
		}

		// Attach claims to context
		c.Set("userClaims", claims)
		c.Next()
	}
}

func validateJWT(tokenStr string, db *gorm.DB) (*utils.JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &utils.JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		return jwtSecret, nil
	})

	if err != nil || !token.Valid {
		return nil, errors.New("invalid token in validateJWT")
	}

	claims, ok := token.Claims.(*utils.JWTClaims)
	if !ok {
		return nil, errors.New("invalid claims")
	}

	var user models.User
	if err := db.First(&user, "id = ?", claims.UserID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, errors.New("user not found")
		}
		return nil, err
	}

	if user.Status != "active" {
		return nil, errors.New("user is not active")
	}

	if user.TokenVersion != claims.TokenVersion {
		return nil, errors.New("token expired/invalid due to password change")
	}

	return claims, nil
}
