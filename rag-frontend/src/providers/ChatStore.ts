import { TMessage } from "@/types";
import { create } from "zustand";

type ChatStore = {
  chatId: string | null;
  messages: TMessage[];
  isStreaming: boolean;

  abortController: AbortController | null;

  setChatId: (id: string | null) => void;
  addMessage: (message: TMessage) => void;
  appendVersionChunk: (
    messageKey: string,
    versionId: string,
    chunk: string,
  ) => void;

  setStreaming: (value: boolean) => void;
  setAbortController: (controller: AbortController | null) => void;
  cancelStream: () => void;

  replaceChatId: (realId: string) => void;
  clear: () => void;
};

export const useChatStore = create<ChatStore>((set, get) => ({
  chatId: null,
  messages: [],
  isStreaming: false,
  abortController: null,

  setChatId: (id) => set({ chatId: id }),

  addMessage: (message) =>
    set((state) => ({
      messages: [...state.messages, message],
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

  setAbortController: (controller) => set({ abortController: controller }),

  cancelStream: () => {
    const controller = get().abortController;
    if (controller) controller.abort();

    set({ isStreaming: false, abortController: null });
  },

  replaceChatId: (realId) => set({ chatId: realId }),

  clear: () =>
    set({
      chatId: null,
      messages: [],
      isStreaming: false,
      abortController: null,
    }),
}));
