"use client";

import ChatBox from "@/components/ai-components/ChatBox";
import Messages from "@/components/ai-components/Messages";
import { useChatMessages } from "@/hooks/chats";
import { useAutoScroll } from "@/hooks/useAutoScroll";
import { useChatActions } from "@/hooks/useChatActions";
import { mapBackendMessagesToStore } from "@/lib/utils";
import { useChatStore } from "@/providers/ChatStore";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";

export default function ChatConversationPage() {
  const params = useParams();
  const chatId = params?.chatId as string;

  const {
    messages,
    setMessages,
    isWaitingResponse,
    cancelStream,
    isStreaming,
  } = useChatStore();
  const { sendMessage } = useChatActions();
  const { data } = useChatMessages(chatId);

  const hydratedChatRef = useRef<string | null>(null);

  const { containerRef, scrollToBottom } = useAutoScroll(messages);

  useEffect(() => {
    if (!data || chatId === "new") return;

    const justCreated = sessionStorage.getItem("justCreatedChat");

    if (justCreated === chatId) {
      sessionStorage.removeItem("justCreatedChat");
      return;
    }

    if (hydratedChatRef.current === chatId) return;

    setMessages(mapBackendMessagesToStore(data));
    hydratedChatRef.current = chatId;
  }, [data, chatId, setMessages]);

  const handleSubmitMessage = (message: string) => {
    if (!message.trim()) return;
    scrollToBottom();
    sendMessage(message, { isNewChat: false });
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div ref={containerRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl p-2">
          <Messages
            messages={messages}
            key={chatId}
            isWaitingResponse={isWaitingResponse}
          />
        </div>
      </div>

      {/* Input */}
      <div className="mx-auto w-full max-w-4xl p-4">
        <ChatBox
          onSend={handleSubmitMessage}
          onCancel={cancelStream}
          isLoading={isWaitingResponse || isStreaming}
        />{" "}
      </div>
    </div>
  );
}
