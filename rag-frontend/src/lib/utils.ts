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

export const getInitials = (name?: string, maxLength = 2): string => {
  if (!name || typeof name !== "string") return "";

  const words = name.trim().split(/\s+/).filter(Boolean);

  if (words.length === 0) return "";

  const initials = words
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return initials.slice(0, maxLength);
};

export const formatDateTime = (date: string | Date): string => {
  if (!date) return "";

  const d = new Date(date);

  return (
    d.toLocaleString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    }) +
    " • " +
    d.toLocaleString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
  );
};
