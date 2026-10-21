import {
  deleteDocument,
  fetchDocumentResources,
  fetchDocumentStats,
  getDocumentDownloadUrl,
  trainDocuments,
  uploadDocuments,
} from "@/apis/documents";
import { DocumentListParams } from "@/types/apis";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useDocumentResources = (params: DocumentListParams) => {
  return useQuery({
    queryKey: ["documents", "resources", params],
    queryFn: () => fetchDocumentResources(params),
    staleTime: 1000 * 60 * 5,
    // Keep the current page visible while the next loads.
    placeholderData: (previous) => previous,
    // Training finishes in a Celery worker, so status changes with nothing
    // to tell the page. Poll only while something on this page is actually
    // training, then stop -- an idle list should not generate traffic.
    refetchInterval: (query) =>
      query.state.data?.documents?.some((doc) => doc.status === "training")
        ? 3000
        : false,
  });
};

/** Org-wide usage. Separate from the list because the list is one page:
 *  summing it would under-count and let an org exceed its quota. */
export const useDocumentStats = () => {
  return useQuery({
    queryKey: ["documents", "stats"],
    queryFn: fetchDocumentStats,
    staleTime: 1000 * 60 * 5,
    refetchInterval: (query) =>
      query.state.data?.training ? 3000 : false,
  });
};

export const useUploadDocuments = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadDocuments,

    onSuccess: () => {
      // Broader prefix: covers every page of the list and the stats that
      // drive the quota display.
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      // Storage and document counts feed the dashboard too.
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
  });
};

export const useDeleteDocument = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => deleteDocument(documentId),

    onSuccess: () => {
      // Broader prefix: covers every page of the list and the stats that
      // drive the quota display.
      queryClient.invalidateQueries({ queryKey: ["documents"] });

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
      // Broader prefix: covers every page of the list and the stats that
      // drive the quota display.
      queryClient.invalidateQueries({ queryKey: ["documents"] });

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
