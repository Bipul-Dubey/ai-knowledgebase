import ChatBox from "@/components/ai-components/ChatBox";

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;

  return (
    <div className="flex h-full flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl">Messages for {chatId}</div>
      </div>

      {/* Input */}
      <div className="mx-auto w-full max-w-4xl">
        <ChatBox />
      </div>
    </div>
  );
}
