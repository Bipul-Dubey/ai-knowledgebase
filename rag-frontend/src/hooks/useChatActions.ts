"use client";

import { useRouter, useParams } from "next/navigation";
import { useChatStore } from "@/providers/ChatStore";
import { ENV } from "@/constants/environments";
import { PATHS } from "@/constants/paths";
import { useChatsList } from "./chats";
import { useQueryClient } from "@tanstack/react-query";

type SendOptions = {
  skipUserAdd?: boolean;
  isNewChat: boolean;
};

export const useChatActions = () => {
  const router = useRouter();
  const params = useParams<{ orgId: string; chatId: string }>();
  const { chatId, orgId } = params;
  const {
    lastChatId,
    setLastChatId,
    addMessage,
    appendVersionChunk,
    setVersionSources,
    setStreaming,
    setAbortController,
    setWaitingResponse,
  } = useChatStore();

  const { refetch } = useChatsList();
  const queryClient = useQueryClient();

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

    // For a new chat the real id only arrives with the chat_id event.
    let activeChatId: string | null = options?.isNewChat ? null : chatId;

    const controller = new AbortController();
    setAbortController(controller);
    setStreaming(true);
    setWaitingResponse(true);

    if (lastChatId != chatId) {
      refetch();
      setLastChatId(chatId);
    }

    try {
      const response = await fetch(`${ENV.BASE_API_URL_CHATS}/chats/query`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: input,
          chatId: options?.isNewChat ? undefined : chatId,
        }),
        signal: controller.signal,
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let buffer = "";
      let firstChunkReceived = false;

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
              if (parsed.event === "chat_id") {
                activeChatId = parsed.chatId;

                if (options?.isNewChat) {
                  sessionStorage.setItem("justCreatedChat", parsed.chatId);

                  router.replace(PATHS.pl.CHAT(orgId, parsed.chatId));
                  refetch();
                }
              }

              // 🌊 streaming chunks
              if (parsed.event === "response") {
                // FIRST STREAM CHUNK RECEIVED
                if (!firstChunkReceived) {
                  firstChunkReceived = true;
                  setWaitingResponse(false);
                }

                appendVersionChunk(
                  assistantKey,
                  versionId,
                  parsed.content ?? "",
                );
              }

              // 🎯 final event - carries the documents the answer came from
              if (parsed.event === "final" && Array.isArray(parsed.sources)) {
                setVersionSources(assistantKey, versionId, parsed.sources);
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
      setWaitingResponse(false);
      setAbortController(null);

      // This chat's messages query was filled mid-stream, before the
      // assistant row existed. Drop that snapshot so coming back to the
      // chat refetches the whole thread instead of just the question.
      if (activeChatId) {
        queryClient.invalidateQueries({
          queryKey: ["chat-messages", activeChatId],
        });
      }
    }
  };

  return { sendMessage };
};
