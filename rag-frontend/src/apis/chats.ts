import {
  ApiResponse,
  IBackendMessage,
  IChatMessagesPayload,
  IConversation,
} from "@/types/apis";
import axiosInstance from "./middleware";
import { ENV } from "@/constants/environments";

export const fetchConversations = async (): Promise<
  ApiResponse<IConversation[] | null>
> => {
  const response = await axiosInstance.get<ApiResponse<IConversation[]>>(
    "/chats/list",
    { baseURL: ENV.BASE_API_URL_CHATS },
  );
  return response.data;
};

export const deleteConversation = async (chatId: string): Promise<void> => {
  await axiosInstance.delete(`/chats/${chatId}`, {
    baseURL: ENV.BASE_API_URL_CHATS,
  });
};

export const fetchChatMessages = async (
  chatId: string,
): Promise<IBackendMessage[]> => {
  const response = await axiosInstance.get<ApiResponse<IChatMessagesPayload>>(
    `/chats/${chatId}`,
    {
      baseURL: ENV.BASE_API_URL_CHATS,
    },
  );

  if (!response.data.data) {
    return [];
  }

  return response.data.data.messages;
};
