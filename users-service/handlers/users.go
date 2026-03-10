package handlers

import (
	"net/http"

	"github.com/Bipul-Dubey/ai-knowledgebase/shared/models"
	"github.com/Bipul-Dubey/ai-knowledgebase/shared/utils"
	"github.com/Bipul-Dubey/ai-knowledgebase/users-service/services"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

// UserHandler handles user-related endpoints
type UserHandler struct {
	userService services.UserService
}

func NewUserHandler(userService services.UserService) *UserHandler {
	return &UserHandler{userService: userService}
}

// InviteUserHandler invites a new user
func (h *UserHandler) InviteUserHandler(c *gin.Context) {
	// 🔹 Get current user info from middleware
	claims, exists := c.Get("userClaims")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.APIResponse(true, "unauthorized", nil, http.StatusUnauthorized))
		return
	}
	userClaims := claims.(*utils.JWTClaims)

	var req models.InviteUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, utils.APIResponse(true, "Invalid request payload", nil, http.StatusBadRequest))
		return
	}

	// 🔹 Call service
	resp, err := h.userService.InviteUser(
		uuid.MustParse(userClaims.UserID),
		userClaims.Role,
		uuid.MustParse(userClaims.OrganizationID),
		req,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, utils.APIResponse(true, err.Error(), nil, http.StatusBadRequest))
		return
	}

	c.JSON(http.StatusOK, utils.APIResponse(false, "User invited successfully", resp))
}

func (h *UserHandler) GetUsersByOrganization(c *gin.Context) {
	claimsRaw, exists := c.Get("userClaims")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.APIResponse(true, "unauthorized", nil, http.StatusUnauthorized))
		return
	}
	claims := claimsRaw.(*utils.JWTClaims)

	orgID := claims.OrganizationID

	users, err := h.userService.GetUsersByOrganization(orgID)
	if err != nil {
		c.JSON(http.StatusInternalServerError,
			utils.APIResponse(
				true,
				err.Error(),
				nil,
				http.StatusInternalServerError,
			),
		)
		return
	}

	c.JSON(http.StatusOK,
		utils.APIResponse(
			false,
			"Users fetched successfully",
			users,
		),
	)
}

func (h *UserHandler) GetUserByID(c *gin.Context) {
	claimsRaw, exists := c.Get("userClaims")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.APIResponse(true, "unauthorized", nil, http.StatusUnauthorized))
		return
	}
	claims := claimsRaw.(*utils.JWTClaims)

	orgID := claims.OrganizationID

	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest,
			utils.APIResponse(
				true,
				"user id is required",
				nil,
				http.StatusBadRequest,
			),
		)
		return
	}

	user, err := h.userService.GetUserByID(orgID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound,
			utils.APIResponse(
				true,
				err.Error(),
				nil,
				http.StatusNotFound,
			),
		)
		return
	}

	c.JSON(http.StatusOK,
		utils.APIResponse(
			false,
			"User fetched successfully",
			user,
		),
	)
}

func (h *UserHandler) GetCurrentUser(c *gin.Context) {
	claimsRaw, exists := c.Get("userClaims")
	if !exists {
		c.JSON(http.StatusUnauthorized,
			utils.APIResponse(true, "unauthorized", nil, http.StatusUnauthorized),
		)
		return
	}

	claims := claimsRaw.(*utils.JWTClaims)

	orgID := claims.OrganizationID
	userID := claims.UserID

	user, err := h.userService.GetUserByID(orgID, userID)
	if err != nil {
		c.JSON(http.StatusNotFound,
			utils.APIResponse(true, err.Error(), nil, http.StatusNotFound),
		)
		return
	}

	c.JSON(http.StatusOK,
		utils.APIResponse(false, "User fetched successfully", user),
	)
}

func (h *UserHandler) DeleteUser(c *gin.Context) {
	targetUserID := c.Param("id")

	if targetUserID == "" {
		c.JSON(
			http.StatusBadRequest,
			utils.APIResponse(true, "user id is required", nil, http.StatusBadRequest),
		)
		return
	}

	claimsRaw, exists := c.Get("userClaims")
	if !exists {
		c.JSON(
			http.StatusUnauthorized,
			utils.APIResponse(true, "unauthorized", nil, http.StatusUnauthorized),
		)
		return
	}

	claims := claimsRaw.(*utils.JWTClaims)

	err := h.userService.DeleteUser(
		claims.OrganizationID,
		claims.UserID,
		claims.Role,
		targetUserID,
	)

	if err != nil {
		c.JSON(
			http.StatusForbidden,
			utils.APIResponse(true, err.Error(), nil, http.StatusForbidden),
		)
		return
	}

	c.JSON(
		http.StatusOK,
		utils.APIResponse(false, "user deleted successfully", nil, http.StatusOK),
	)
}

func (h *UserHandler) SuspendUser(c *gin.Context) {
	targetUserID := c.Param("id")

	if targetUserID == "" {
		c.JSON(
			http.StatusBadRequest,
			utils.APIResponse(true, "user id is required", nil, http.StatusBadRequest),
		)
		return
	}

	claimsRaw, exists := c.Get("userClaims")
	if !exists {
		c.JSON(
			http.StatusUnauthorized,
			utils.APIResponse(true, "unauthorized", nil, http.StatusUnauthorized),
		)
		return
	}

	claims := claimsRaw.(*utils.JWTClaims)

	err := h.userService.SuspendUser(
		claims.OrganizationID,
		claims.UserID,
		claims.Role,
		targetUserID,
	)

	if err != nil {
		c.JSON(
			http.StatusForbidden,
			utils.APIResponse(true, err.Error(), nil, http.StatusForbidden),
		)
		return
	}

	c.JSON(
		http.StatusOK,
		utils.APIResponse(false, "user deleted successfully", nil, http.StatusOK),
	)
}
