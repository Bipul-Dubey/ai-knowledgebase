import {
  AcceptInvitePayload,
  ApiResponse,
  PaginatedUsers,
  UpdateUserRolePayload,
  UserListParams,
  UserStats,
  DashboardStatsResponse,
  InviteUserPayload,
  IUser,
  IOrganizationDetails,
} from "@/types/apis";
import axiosInstance from "./middleware";

export const getOrganizationDetails = async () => {
  const res = await axiosInstance.get<ApiResponse<IOrganizationDetails>>(
    "/organization/details",
  );

  return res.data;
};

export async function fetchDashboardStats(): Promise<DashboardStatsResponse> {
  const response = await axiosInstance.get(`/organization/dashboard-stats`);

  return response.data.data;
}

export const fetchUsers = async ({
  page,
  limit,
  search,
}: UserListParams): Promise<PaginatedUsers> => {
  const response = await axiosInstance.get<ApiResponse<PaginatedUsers>>(
    "/users",
    { params: { page, limit, ...(search ? { search } : {}) } },
  );

  return (
    response.data.data ?? {
      users: [],
      total: 0,
      page,
      limit,
      total_pages: 0,
    }
  );
};

export const fetchUserStats = async (): Promise<UserStats | null> => {
  const response = await axiosInstance.get<ApiResponse<UserStats>>(
    "/users/stats",
  );

  return response.data.data ?? null;
};

export const inviteUser = async (payload: InviteUserPayload) => {
  const response = await axiosInstance.post("/users/invite", payload);

  return response.data;
};

export const acceptInvite = async (payload: AcceptInvitePayload) => {
  const response = await axiosInstance.post("/accept-invite", payload);

  return response.data;
};

export const getCurrentUser = async (): Promise<ApiResponse<IUser>> => {
  const { data } = await axiosInstance.get("/users/me");
  return data;
};

export const deleteOrganization = async () => {
  const { data } = await axiosInstance.delete(`/organization`);
  return data;
};

export const deleteUser = async (userId: string) => {
  const { data } = await axiosInstance.delete<ApiResponse<null>>(
    `/users/${userId}`,
  );

  return data;
};

export const updateUserRole = async ({
  userId,
  role,
}: UpdateUserRolePayload) => {
  const { data } = await axiosInstance.patch<ApiResponse<null>>(
    `/users/${userId}/role`,
    { role },
  );

  return data;
};

export const suspendUser = async (userId: string) => {
  const { data } = await axiosInstance.patch<ApiResponse<null>>(
    `/users/${userId}/suspend`,
  );

  return data;
};

export const resendInvite = async (userId: string) => {
  const { data } = await axiosInstance.post<ApiResponse<null>>(
    `/users/${userId}/resend-invite`,
  );

  return data;
};
