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

export const formatFileSize = (bytes?: number): string => {
  if (!bytes && bytes !== 0) return "-";

  const sizes = ["B", "KB", "MB", "GB", "TB"];
  if (bytes === 0) return "0 B";

  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(2) + " " + sizes[i];
};
