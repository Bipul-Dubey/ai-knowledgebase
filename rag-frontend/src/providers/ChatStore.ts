import { TMessage } from "@/types";
import { create } from "zustand";

type ChatStore = {
  messages: TMessage[];
  isStreaming: boolean;
  isWaitingResponse: boolean;
  lastChatId: string | null;

  abortController: AbortController | null;

  addMessage: (message: TMessage) => void;
  setMessages: (messages: TMessage[]) => void;
  appendVersionChunk: (
    messageKey: string,
    versionId: string,
    chunk: string,
  ) => void;

  setStreaming: (value: boolean) => void;
  setWaitingResponse: (val: boolean) => void;
  setAbortController: (controller: AbortController | null) => void;
  cancelStream: () => void;
  setLastChatId: (chatId: string | null) => void;

  clear: () => void;
};

export const useChatStore = create<ChatStore>((set, get) => ({
  chatId: null,
  messages: [],
  isStreaming: false,
  abortController: null,
  isWaitingResponse: false,
  lastChatId: null,

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
    })),

  setMessages: (messages) =>
    set(() => ({
      messages: messages,
    })),

  appendVersionChunk: (messageKey, versionId, chunk) =>
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg.key !== messageKey) return msg;

        return {
          ...msg,
          versions: msg.versions?.map((v) =>
            v.id === versionId ? { ...v, content: v.content + chunk } : v,
          ),
        };
      }),
    })),

  setStreaming: (value) => set({ isStreaming: value }),
  setWaitingResponse: (val) => set({ isWaitingResponse: val }),

  setAbortController: (controller) => set({ abortController: controller }),

  cancelStream: () => {
    const controller = get().abortController;
    if (controller) controller.abort();

    set({ isStreaming: false, abortController: null });
  },

  setLastChatId: (chatId) =>
    set({
      lastChatId: chatId,
    }),

  clear: () =>
    set({
      messages: [],
      isStreaming: false,
      abortController: null,
    }),
}));
