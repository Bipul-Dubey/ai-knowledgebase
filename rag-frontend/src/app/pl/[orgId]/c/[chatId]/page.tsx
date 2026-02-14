"use client";

import ChatBox from "@/components/ai-components/ChatBox";
import Messages from "@/components/ai-components/Messages";
import { useChatMessages } from "@/hooks/chats";
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
    chatId: chatIdReal,
    setChatId,
  } = useChatStore();

  const { sendMessage } = useChatActions();
  const { data } = useChatMessages(chatId);

  const hasTriggered = useRef(false);

  /**
   * Sync route → store
   */
  useEffect(() => {
    if (!chatId) return;

    if (chatIdReal !== chatId) {
      hasTriggered.current = false;
      setChatId(chatId);
      setMessages([]);
    }
  }, [chatId, chatIdReal, setChatId, setMessages]);

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

  useEffect(() => {
    if (!data || chatId === "new") return;

    const mapped = mapBackendMessagesToStore(data);
    setMessages(mapped);
  }, [data, chatId, setMessages]);

  const handleSubmitMessage = (message: string) => {
    if (!message.trim()) return;

    sendMessage(message);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl p-2">
          <Messages messages={messages} key={chatId} />
        </div>
      </div>

      {/* Input */}
      <div className="mx-auto w-full max-w-4xl p-4">
        <ChatBox onSend={handleSubmitMessage} />{" "}
      </div>
    </div>
  );
}
