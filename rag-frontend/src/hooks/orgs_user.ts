import {
  acceptInvite,
  deleteOrganization,
  deleteUser,
  fetchDashboardStats,
  fetchUsers,
  getCurrentUser,
  getOrganizationDetails,
  inviteUser,
  resendInvite,
} from "@/apis/orgs_user";
import { PATHS } from "@/constants/paths";
import { ApiResponse, IUser } from "@/types/apis";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useRouter } from "next/navigation";
import { useSnackbar } from "notistack";

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

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation<ApiResponse<null>, AxiosError<ApiResponse<null>>, string>({
    mutationFn: deleteUser,

    onSuccess: (data) => {
      enqueueSnackbar(data?.message ?? "User removed successfully", {
        variant: "success",
      });

      queryClient.invalidateQueries({ queryKey: ["users"] });
    },

    onError: (error) => {
      enqueueSnackbar(
        error.response?.data?.message ?? "Failed to remove user",
        { variant: "error" },
      );
    },
  });
};

export const useResendInvite = () => {
  const { enqueueSnackbar } = useSnackbar();

  return useMutation<ApiResponse<null>, AxiosError<ApiResponse<null>>, string>({
    mutationFn: resendInvite,

    onSuccess: (data) => {
      enqueueSnackbar(data?.message ?? "Invitation resent successfully", {
        variant: "success",
      });
    },

    onError: (error) => {
      enqueueSnackbar(
        error.response?.data?.message ?? "Failed to resend invitation",
        { variant: "error" },
      );
    },
  });
};
