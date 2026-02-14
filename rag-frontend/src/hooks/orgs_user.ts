import { getOrganizationDetails } from "@/apis/orgs_user";
import { useQuery } from "@tanstack/react-query";

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
