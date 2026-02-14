import { fetchConversations } from "@/apis/chats";
import { useQuery } from "@tanstack/react-query";

export const useChatsList = () => {
  return useQuery({
    queryKey: ["orgs-user", "conversations"],
    queryFn: fetchConversations,
    placeholderData: (previousData) => previousData,
  });
};
