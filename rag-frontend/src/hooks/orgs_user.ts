import {
  acceptInvite,
  deleteOrganization,
  deleteUser,
  fetchDashboardStats,
  fetchUsers,
  fetchUserStats,
  getCurrentUser,
  getOrganizationDetails,
  inviteUser,
  resendInvite,
  suspendUser,
  updateUserRole,
} from "@/apis/orgs_user";
import { PATHS } from "@/constants/paths";
import {
  ApiResponse,
  IUser,
  PaginatedUsers,
  UpdateUserRolePayload,
  UserListParams,
} from "@/types/apis";
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

export const useUsers = (params: UserListParams) => {
  return useQuery<PaginatedUsers>({
    queryKey: ["users", params],
    queryFn: () => fetchUsers(params),
    staleTime: 1000 * 60 * 2,
    // Keep the current page on screen while the next one loads, so paging
    // does not flash an empty list.
    placeholderData: (previous) => previous,
  });
};

export const useUserStats = () => {
  return useQuery({
    queryKey: ["users", "stats"],
    queryFn: fetchUserStats,
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

export const useUpdateUserRole = () => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation<
    ApiResponse<null>,
    AxiosError<ApiResponse<null>>,
    UpdateUserRolePayload
  >({
    mutationFn: updateUserRole,

    onSuccess: (data) => {
      // The change revokes their existing session, so say so rather than
      // leaving them to discover it as a surprise logout.
      enqueueSnackbar(
        data?.message ?? "Role updated. They will need to sign in again.",
        { variant: "success" },
      );

      queryClient.invalidateQueries({ queryKey: ["users"] });
    },

    onError: (error) => {
      enqueueSnackbar(error.response?.data?.message ?? "Failed to update role", {
        variant: "error",
      });
    },
  });
};

export const useSuspendUser = () => {
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  return useMutation<ApiResponse<null>, AxiosError<ApiResponse<null>>, string>({
    mutationFn: suspendUser,

    onSuccess: (data) => {
      enqueueSnackbar(data?.message ?? "User suspend successfully", {
        variant: "success",
      });

      queryClient.invalidateQueries({ queryKey: ["users"] });
    },

    onError: (error) => {
      enqueueSnackbar(
        error.response?.data?.message ?? "Failed to suspend user",
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
