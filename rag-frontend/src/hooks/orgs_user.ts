import { getOrganizationDetails } from "@/apis/orgs_user";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const useOrganizationDetails = () => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ["organization-details"],
    queryFn: async () => {
      const data = await getOrganizationDetails();

      queryClient.invalidateQueries({
        queryKey: ["orgs-user"],
      });

      return data;
    },
    staleTime: 5 * 60 * 1000,
    enabled: false,
  });
};