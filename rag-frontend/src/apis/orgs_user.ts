import {
  AcceptInvitePayload,
  ApiResponse,
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

export const fetchUsers = async (): Promise<IUser[]> => {
  const response = await axiosInstance.get<ApiResponse<IUser[]>>("/users");

  return response.data.data ?? [];
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
  const { data } = await axiosInstance.delete(`/organizations`);
  return data;
};

export const deleteUser = async (userId: string) => {
  const { data } = await axiosInstance.delete<ApiResponse<null>>(
    `/users/${userId}`,
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
