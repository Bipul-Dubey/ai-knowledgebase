import {
  deleteDocument,
  fetchDocumentResources,
  getDocumentDownloadUrl,
  trainDocuments,
  uploadDocument,
} from "@/apis/documents";
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

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => deleteDocument(documentId),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["documents", "resources"],
      });

      queryClient.invalidateQueries({
        queryKey: ["dashboard-stats"],
      });
    },
  });
};

export const useTrainDocuments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentIds: string[]) =>
      trainDocuments({ document_ids: documentIds }),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["documents", "resources"],
      });

      queryClient.invalidateQueries({
        queryKey: ["dashboard-stats"],
      });
    },
  });
};

export const useDocumentDownloadUrl = (documentId: string) => {
  return useQuery({
    queryKey: ["document-download-url", documentId],
    queryFn: async () => {
      const res = await getDocumentDownloadUrl(documentId);

      const now = Date.now();
      const expiry = new Date(res?.expires_at).getTime();

      const remainingTime = expiry - now;

      return {
        ...res,
        remainingTime,
      };
    },
    enabled: false, // fetch only when clicked
    staleTime: Infinity, // we control expiry manually
    gcTime: 1000 * 60 * 65, // 65 min max
  });
};
