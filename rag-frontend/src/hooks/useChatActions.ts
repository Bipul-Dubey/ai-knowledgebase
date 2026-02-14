"use client";

import { useRouter, useParams } from "next/navigation";
import { useChatStore } from "@/providers/ChatStore";
import { ENV } from "@/constants/environments";
import { PATHS } from "@/constants/paths";

type SendOptions = {
  skipUserAdd?: boolean;
};

export const useChatActions = () => {
  const router = useRouter();
  const params = useParams<{ orgId: string }>();

  const {
    chatId,
    addMessage,
    appendVersionChunk,
    replaceChatId,
    setStreaming,
    setAbortController,
  } = useChatStore();

  const sendMessage = async (input: string, options?: SendOptions) => {
    if (!input.trim()) return;

    const token =
      typeof window !== "undefined"
        ? localStorage.getItem("access_token")
        : null;

    if (!token) {
      console.error("No auth token found");
      return;
    }

    const userKey = crypto.randomUUID();
    const assistantKey = crypto.randomUUID();
    const versionId = crypto.randomUUID();

    if (!options?.skipUserAdd) {
      addMessage({
        key: userKey,
        from: "user",
        content: input,
      });
    }

    addMessage({
      key: assistantKey,
      from: "assistant",
      versions: [{ id: versionId, content: "" }],
    });

    const isNewChat = chatId === "new";

    const controller = new AbortController();
    setAbortController(controller);
    setStreaming(true);

    try {
      const response = await fetch(`${ENV.BASE_API_URL_CHATS}/chats/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: input,
          chatId: isNewChat ? undefined : chatId,
        }),
        signal: controller.signal,
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() || "";

        for (const eventBlock of events) {
          const lines = eventBlock.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;

            const jsonString = line.replace("data:", "").trim();

            if (!jsonString) continue;

            try {
              const parsed = JSON.parse(jsonString);

              // 🔥 chat_id
              if (parsed.event === "chat_id" && isNewChat) {
                replaceChatId(parsed.chatId);
                router.replace(PATHS.pl.CHAT(params?.orgId, chatId));
              }

              // 🌊 streaming chunks
              if (parsed.event === "response") {
                appendVersionChunk(
                  assistantKey,
                  versionId,
                  parsed.content ?? "",
                );
              }

              // 🎯 final event
              if (parsed.event === "final") {
                console.log("Final:", parsed.answer);
              }
            } catch (err) {
              console.error("SSE parse error:", err);
            }
          }
        }
      }
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
        console.log("Stream cancelled");
        return;
      }

      if (error instanceof Error) {
        console.error("Stream error:", error.message);
      } else {
        console.error("Unknown stream error:", error);
      }
    } finally {
      setStreaming(false);
      setAbortController(null);
    }
  };

  return { sendMessage };
};
