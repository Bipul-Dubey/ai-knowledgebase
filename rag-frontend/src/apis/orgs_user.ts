import {
  AcceptInvitePayload,
  ApiResponse,
  DashboardStatsResponse,
  InviteUserPayload,
  IUser,
  OrganizationDetails,
} from "@/types/apis";
import axiosInstance from "./middleware";

export const getOrganizationDetails = async () => {
  const res = await axiosInstance.get<ApiResponse<OrganizationDetails>>(
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
