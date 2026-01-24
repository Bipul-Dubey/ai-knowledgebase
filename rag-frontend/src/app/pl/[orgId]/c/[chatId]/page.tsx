import ChatBox from "@/components/ai-components/ChatBox";
import Messages from "@/components/ai-components/Messages";

export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ chatId: string }>;
}) {
  const { chatId } = await params;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-4xl p-2">
          <Messages />
        </div>
      </div>

      {/* Input */}
      <div className="mx-auto w-full max-w-4xl p-4">
        <ChatBox />
      </div>
    </div>
  );
}
