"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { ArrowUpIcon, Square } from "lucide-react";

type ChatBoxProps = {
  onSend: (message: string) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  placeholder?: string;
};

const ChatBox = ({
  onSend,
  onCancel,
  isLoading = false,
  placeholder = "Ask your query...",
}: ChatBoxProps) => {
  const [value, setValue] = useState("");

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  });

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;

    onSend(trimmed);
    setValue("");
    adjustHeight(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="w-full">
      <div className="border-border bg-secondary/20 relative rounded-xl border">
        <div className="overflow-y-auto">
          <Textarea
            ref={textareaRef}
            value={value}
            disabled={isLoading}
            onChange={(e) => {
              setValue(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn(
              "w-full px-4 py-3",
              "resize-none",
              "bg-transparent",
              "border-none",
              "text-sm",
              "focus:outline-none",
              "focus-visible:ring-0 focus-visible:ring-offset-0",
              "placeholder:text-sm",
              "min-h-15",
              isLoading && "opacity-70",
            )}
            style={{ overflowY: "auto" }}
          />
        </div>

        <div className="flex items-center justify-end p-3">
          {isLoading ? (
            <button
              type="button"
              onClick={onCancel}
              className="border-border flex items-center justify-center rounded-lg border bg-red-500 px-2 py-2 text-white transition-colors hover:bg-red-600"
            >
              <Square className="h-4 w-4" />
              <span className="sr-only">Cancel</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSend}
              disabled={!value.trim()}
              className={cn(
                "border-border flex items-center justify-center rounded-lg border px-2 py-2 transition-colors",
                value.trim() ? "bg-white text-black" : "text-zinc-400",
              )}
            >
              <ArrowUpIcon
                className={cn(
                  "h-4 w-4",
                  value.trim() ? "text-black" : "text-zinc-400",
                )}
              />
              <span className="sr-only">Send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
