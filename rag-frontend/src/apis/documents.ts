import { ENV } from "@/constants/environments";
import {
  ApiResponse,
  DocumentListParams,
  DocumentStats,
  IDocumentResource,
  PaginatedDocuments,
  IDownloadUrlResponse,
  TrainDocumentsPayload,
  UploadResult,
} from "@/types/apis";
import axiosInstance from "./middleware";

export const fetchDocumentResources = async ({
  page,
  limit,
  search,
}: DocumentListParams): Promise<PaginatedDocuments> => {
  const response = await axiosInstance.get<ApiResponse<PaginatedDocuments>>(
    "/documents/resources",
    {
      baseURL: ENV.BASE_API_URL_CHATS,
      params: { page, limit, ...(search ? { search } : {}) },
    },
  );

  return (
    response.data.data ?? {
      documents: [],
      total: 0,
      page,
      limit,
      total_pages: 0,
    }
  );
};

export const fetchDocumentStats = async (): Promise<DocumentStats | null> => {
  const response = await axiosInstance.get<ApiResponse<DocumentStats>>(
    "/documents/stats",
    { baseURL: ENV.BASE_API_URL_CHATS },
  );

  return response.data.data ?? null;
};

export const uploadDocuments = async (
  files: File[],
): Promise<UploadResult> => {
  const formData = new FormData();
  // Repeated "files" entries, which is what List[UploadFile] expects.
  files.forEach((file) => formData.append("files", file));

  const response = await axiosInstance.post<ApiResponse<UploadResult>>(
    "/documents/upload",
    formData,
    {
      baseURL: ENV.BASE_API_URL_CHATS,
      headers: {
        "Content-Type": "multipart/form-data",
      },
    },
  );

  if (!response.data.data) {
    throw new Error(response.data.message || "Upload failed");
  }

  return response.data.data;
};

export const deleteDocument = async (documentId: string) => {
  const response = await axiosInstance.delete(
    `/documents/delete/${documentId}`,
    { baseURL: ENV.BASE_API_URL_CHATS },
  );

  return response.data;
};

export const trainDocuments = async (payload: TrainDocumentsPayload) => {
  const response = await axiosInstance.post("/documents/train", payload, {
    baseURL: ENV.BASE_API_URL_CHATS,
  });

  return response.data;
};

export const getDocumentDownloadUrl = async (
  documentId: string,
): Promise<IDownloadUrlResponse> => {
  const { data } = await axiosInstance.get(
    `/documents/download/${documentId}`,
    { baseURL: ENV.BASE_API_URL_CHATS },
  );
  return data.data;
};
