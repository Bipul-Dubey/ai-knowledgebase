import {
  acceptInvite,
  deleteOrganization,
  fetchDashboardStats,
  fetchUsers,
  getCurrentUser,
  getOrganizationDetails,
  inviteUser,
} from "@/apis/orgs_user";
import { PATHS } from "@/constants/paths";
import { ApiResponse, IUser } from "@/types/apis";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export const useOrganizationDetails = () => {
  return useQuery({
    queryKey: ["organization-details"],
    queryFn: async () => {
      const data = await getOrganizationDetails();

      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: false,
  });
};

export const useDashboardStats = () => {
  return useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: fetchDashboardStats,
    staleTime: 5 * 60 * 1000,
  });
};

export const useUsers = () => {
  return useQuery<IUser[]>({
    queryKey: ["users"],
    queryFn: fetchUsers,
    staleTime: 1000 * 60 * 2,
  });
};

export const useInviteUser = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: inviteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
};

export const useAcceptInvite = () => {
  return useMutation({
    mutationFn: acceptInvite,
  });
};

export const useCurrentUser = () => {
  return useQuery<ApiResponse<IUser>>({
    queryKey: ["current-user"],
    queryFn: getCurrentUser,
    staleTime: 1000 * 60 * 5,
    retry: false,
    enabled: false,
  });
};

export const useDeleteOrganization = () => {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: deleteOrganization,

    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.clear();
      localStorage.clear();
      router.replace(PATHS.pl.REGISTER);
    },
  });
};
