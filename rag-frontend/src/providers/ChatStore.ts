import { TMessage } from "@/types";
import { create } from "zustand";

type ChatStore = {
  chatId: string | null;
  messages: TMessage[];
  isStreaming: boolean;
  isWaitingResponse: boolean;

  abortController: AbortController | null;

  setChatId: (id: string | null) => void;
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

  replaceChatId: (realId: string) => void;
  clear: () => void;
};

export const useChatStore = create<ChatStore>((set, get) => ({
  chatId: null,
  messages: [],
  isStreaming: false,
  abortController: null,
  isWaitingResponse: false,

  setChatId: (id) => set({ chatId: id }),

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

  replaceChatId: (realId) => set({ chatId: realId }),

  clear: () =>
    set({
      chatId: null,
      messages: [],
      isStreaming: false,
      abortController: null,
    }),
}));
