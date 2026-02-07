import { getOrganizationDetails } from "@/apis/orgs_user";
import { useQuery } from "@tanstack/react-query";

export const useOrganizationDetails = () =>
  useQuery({
    queryKey: ["organization-details"],
    queryFn: getOrganizationDetails,
    staleTime: 5 * 60 * 1000,
  });
