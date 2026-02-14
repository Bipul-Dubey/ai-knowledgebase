"use client";

import { useParams, useRouter } from "next/navigation";
import ChatBox from "@/components/ai-components/ChatBox";
import { ActionButton } from "@/components/ai-components/chats-common";
import { useChatStore } from "@/providers/ChatStore";
import { AlignLeft, GitCompare, HelpCircle, Search } from "lucide-react";
import { PATHS } from "@/constants/paths";

export default function ChatEmptyPage() {
  const router = useRouter();
  const params = useParams<{ orgId: string }>();

  const { clear, setChatId, addMessage } = useChatStore();

  const handleSubmitMessage = (message: string) => {
    if (!message.trim()) return;

    clear();

    const tempId = "new";
    setChatId(tempId);

    addMessage({
      key: crypto.randomUUID(),
      from: "user",
      content: message,
    });

    router.push(PATHS.pl.CHAT(params.orgId, tempId));
  };

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4">
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center space-y-4 p-4 py-24 sm:space-y-8">
        <h1 className="text-foreground text-center text-2xl font-bold sm:text-4xl">
          What can I help you ship?
        </h1>

        {/* No streaming here */}
        <ChatBox onSend={handleSubmitMessage} />

        <div className="w-full">
          <div className="-mx-4 mt-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex flex-col flex-wrap items-start gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-3 sm:overflow-x-auto sm:pb-2">
              <ActionButton
                icon={<AlignLeft className="h-4 w-4" />}
                label="Summarize our documents"
                prompt="Summarize all available documents for this organization in a clear and structured way."
                onClick={handleSubmitMessage}
              />

              <ActionButton
                icon={<Search className="h-4 w-4" />}
                label="Explore key information"
                prompt="Identify key topics discussed in our documents and explain them briefly."
                onClick={handleSubmitMessage}
              />

              <ActionButton
                icon={<GitCompare className="h-4 w-4" />}
                label="Compare documents"
                prompt="Compare the documents and highlight similarities, differences, and key insights."
                onClick={handleSubmitMessage}
              />

              <ActionButton
                icon={<HelpCircle className="h-4 w-4" />}
                label="Ask from documents"
                prompt="Answer a question using only the information available in our documents."
                onClick={handleSubmitMessage}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
