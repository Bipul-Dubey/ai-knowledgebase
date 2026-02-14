import { fetchDocumentResources, uploadDocument } from "@/apis/documents";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useDocumentResources = () => {
  return useQuery({
    queryKey: ["documents", "resources"],
    queryFn: fetchDocumentResources,
    staleTime: 1000 * 60 * 5,
  });
};

export const useUploadDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadDocument,

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["documents", "resources"],
      });
    },
  });
};
