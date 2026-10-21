package handlers

import (
	"net/http"
	"strconv"

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

func (h *UserHandler) ResendVerificationEmail(c *gin.Context) {
	claimsRaw, exists := c.Get("userClaims")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.APIResponse(true, "unauthorized", nil, http.StatusUnauthorized))
		return
	}
	claims := claimsRaw.(*utils.JWTClaims)

	userID := c.Param("id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, utils.APIResponse(true, "user id is required", nil, http.StatusBadRequest))
		return
	}

	if err := h.userService.ResendVerificationEmail(claims.OrganizationID, userID); err != nil {
		c.JSON(http.StatusBadRequest, utils.APIResponse(true, err.Error(), nil, http.StatusBadRequest))
		return
	}

	c.JSON(http.StatusOK, utils.APIResponse(false, "Verification email resent successfully", nil, http.StatusOK))
}

func (h *UserHandler) GetUsersByOrganization(c *gin.Context) {
	claimsRaw, exists := c.Get("userClaims")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.APIResponse(true, "unauthorized", nil, http.StatusUnauthorized))
		return
	}
	claims := claimsRaw.(*utils.JWTClaims)

	orgID := claims.OrganizationID

	// Invalid or absent values fall back to the service defaults rather
	// than erroring: a bad ?page= should not break the page.
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "10"))

	result, err := h.userService.GetUsersByOrganization(orgID, models.UserListQuery{
		Page:   page,
		Limit:  limit,
		Search: c.Query("search"),
	})
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
			result,
		),
	)
}

func (h *UserHandler) GetUserStats(c *gin.Context) {
	claimsRaw, exists := c.Get("userClaims")
	if !exists {
		c.JSON(http.StatusUnauthorized, utils.APIResponse(true, "unauthorized", nil, http.StatusUnauthorized))
		return
	}
	claims := claimsRaw.(*utils.JWTClaims)

	stats, err := h.userService.GetUserStats(claims.OrganizationID)
	if err != nil {
		c.JSON(http.StatusInternalServerError,
			utils.APIResponse(true, err.Error(), nil, http.StatusInternalServerError),
		)
		return
	}

	c.JSON(http.StatusOK,
		utils.APIResponse(false, "User stats fetched successfully", stats),
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

func (h *UserHandler) UpdateUserRole(c *gin.Context) {
	targetUserID := c.Param("id")

	if targetUserID == "" {
		c.JSON(
			http.StatusBadRequest,
			utils.APIResponse(true, "user id is required", nil, http.StatusBadRequest),
		)
		return
	}

	var req models.UpdateUserRoleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(
			http.StatusBadRequest,
			utils.APIResponse(true, "role must be maintainer or member", nil, http.StatusBadRequest),
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

	err := h.userService.UpdateUserRole(
		claims.OrganizationID,
		claims.UserID,
		claims.Role,
		targetUserID,
		req.Role,
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
		utils.APIResponse(false, "User role updated successfully", nil, http.StatusOK),
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
