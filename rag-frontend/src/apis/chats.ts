import { ApiResponse, IConversation } from "@/types/apis";
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
