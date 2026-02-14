import { ENV } from "@/constants/environments";
import { ApiResponse, IDocumentResource } from "@/types/apis";
import axiosInstance from "./middleware";

export const fetchDocumentResources = async (): Promise<
  IDocumentResource[]
> => {
  const response = await axiosInstance.get<ApiResponse<IDocumentResource[]>>(
    "/documents/resources",
    {
      baseURL: ENV.BASE_API_URL_CHATS,
    },
  );

  return response.data.data ?? [];
};

interface UploadPayload {
  file: File;
  title: string;
}

export const uploadDocument = async (
  payload: UploadPayload,
): Promise<IDocumentResource> => {
  const formData = new FormData();
  formData.append("file", payload.file);
  formData.append("title", payload.title);

  const response = await axiosInstance.post<ApiResponse<IDocumentResource>>(
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
    throw new Error("Upload failed");
  }

  return response.data.data;
};
