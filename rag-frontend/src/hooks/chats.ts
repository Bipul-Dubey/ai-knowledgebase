import {
  deleteConversation,
  fetchChatMessages,
  fetchConversations,
} from "@/apis/chats";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const useChatsList = () => {
  return useQuery({
    queryKey: ["orgs-user", "conversations"],
    queryFn: fetchConversations,
    placeholderData: (previousData) => previousData,
  });
};

export const useDeleteConversation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (chatId: string) => deleteConversation(chatId),

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["orgs-user", "conversations"],
      });
    },
  });
};

export const useChatMessages = (chatId: string | null) => {
  return useQuery({
    queryKey: ["orgs-user", "chat-messages", chatId],
    queryFn: () => fetchChatMessages(chatId!),
    enabled: !!chatId && chatId !== "new",
    staleTime: 1000 * 60 * 2,
  });
};
