"use client";

import ChatBox from "@/components/ai-components/ChatBox";
import Messages from "@/components/ai-components/Messages";
import { useChatActions } from "@/hooks/useChatActions";
import { useChatStore } from "@/providers/ChatStore";
import { useParams } from "next/navigation";
import { useEffect, useRef } from "react";

export default function ChatConversationPage() {
  const params = useParams();
  const chatId = params?.chatId as string;
  const { messages } = useChatStore();
  const { sendMessage } = useChatActions();
  console.log("messages:", messages);

  const hasTriggered = useRef(false);

  useEffect(() => {
    if (chatId === "new" && messages.length === 1 && !hasTriggered.current) {
      hasTriggered.current = true;

      sendMessage(messages[0].content!, { skipUserAdd: true });
    }
  }, [chatId, messages]);

  const handleSubmitMessage = (message: string) => {
    if (!message.trim()) return;

    sendMessage(message);
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Messages */}
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
