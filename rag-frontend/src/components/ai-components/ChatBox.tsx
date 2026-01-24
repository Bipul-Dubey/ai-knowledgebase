"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAutoResizeTextarea } from "@/hooks/use-auto-resize-textarea";
import { ArrowUpIcon } from "lucide-react";

const ChatBox = () => {
  const [value, setValue] = useState("");
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  });

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        setValue("");
        adjustHeight(true);
      }
    }
  };
  return (
    <div className="w-full">
      <div className="border-border bg-secondary/20 relative rounded-xl border">
        <div className="overflow-y-auto">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask your query..."
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
            )}
            style={{
              overflow: "hidden",
            }}
          />
        </div>

        <div className="flex items-center justify-end p-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={cn(
                "border-border flex items-center justify-between gap-1 rounded-lg border px-1.5 py-1.5 text-sm transition-colors",
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
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatBox;
