package middleware

import (
	"net/http"

	"github.com/Bipul-Dubey/ai-knowledgebase/shared/constants"
	"github.com/Bipul-Dubey/ai-knowledgebase/shared/utils"
	"github.com/gin-gonic/gin"
)

func RoleAuthorization(allowedRoles ...constants.RoleEnum) gin.HandlerFunc {
	roleSet := make(map[string]struct{})
	for _, r := range allowedRoles {
		roleSet[string(r)] = struct{}{}
	}

	return func(c *gin.Context) {
		claimsVal, exists := c.Get("userClaims")
		if !exists {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing user claims"})
			return
		}

		claims, ok := claimsVal.(*utils.JWTClaims)
		if !ok {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid user claims"})
			return
		}

		if _, allowed := roleSet[claims.Role]; !allowed {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "unauthorized: insufficient role"})
			return
		}

		c.Next()
	}
}
