import {
  ApiResponse,
  DashboardStatsResponse,
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
