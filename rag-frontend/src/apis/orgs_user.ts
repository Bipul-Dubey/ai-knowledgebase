import { ApiResponse, OrganizationDetails } from "@/types/apis";
import axiosInstance from "./middleware";

export const getOrganizationDetails = async () => {
  const res = await axiosInstance.get<ApiResponse<OrganizationDetails>>(
    "/organization/details",
  );

  return res.data;
};
