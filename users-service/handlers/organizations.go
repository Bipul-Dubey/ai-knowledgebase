package handlers

import (
	"net/http"

	"github.com/Bipul-Dubey/ai-knowledgebase/shared/utils"
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/services"
	"github.com/gin-gonic/gin"
)

type OrganizationHandler struct {
	orgService services.OrganizationService
}

func NewOrganizationHandler(orgService services.OrganizationService) *OrganizationHandler {
	return &OrganizationHandler{orgService: orgService}
}

func (h *OrganizationHandler) GetOrganizationDetails(c *gin.Context) {
	claimsRaw, exists := c.Get("userClaims")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.APIResponse(true, "unauthorized", nil, http.StatusUnauthorized))
		return
	}
	claims := claimsRaw.(*utils.JWTClaims)

	orgID := claims.OrganizationID
	role := claims.Role

	resp, err := h.orgService.GetOrganizationDetails(orgID, role)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.APIResponse(true, err.Error(), nil, http.StatusBadRequest))
		return
	}

	c.JSON(http.StatusOK, utils.APIResponse(false, "organization details fetched", resp))
}
