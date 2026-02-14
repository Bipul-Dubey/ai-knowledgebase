import { TMessage } from "@/types";
import { IBackendMessage } from "@/types/apis";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const mapBackendMessagesToStore = (
  messages: IBackendMessage[],
): TMessage[] => {
  return messages
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    .map((msg) => {
      if (msg.role === "assistant") {
        return {
          key: msg.id,
          from: "assistant",
          versions: [
            {
              id: msg.id,
              content: msg.content,
            },
          ],
        };
      }

      return {
        key: msg.id,
        from: "user",
        content: msg.content,
      };
    });
};
