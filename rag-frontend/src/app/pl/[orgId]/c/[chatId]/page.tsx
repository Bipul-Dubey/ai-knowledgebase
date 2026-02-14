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

  const hasTriggered = useRef(false);
  const { containerRef, scrollToBottom } = useAutoScroll(messages);

  // Hydrate old chat
  useEffect(() => {
    if (!data || chatId === "new") return;

    const mapped = mapBackendMessagesToStore(data);
    setMessages(mapped);
  }, [data, chatId, setMessages]);

  // Auto trigger new chat
  useEffect(() => {
    if (
      chatId === "new" &&
      messages.length === 1 &&
      messages[0].from === "user" &&
      !hasTriggered.current
    ) {
      hasTriggered.current = true;
      sendMessage(messages[0].content!, { skipUserAdd: true });
    }
  }, [chatId, messages, sendMessage]);

  const handleSubmitMessage = (message: string) => {
    if (!message.trim()) return;
    scrollToBottom();
    sendMessage(message);
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
