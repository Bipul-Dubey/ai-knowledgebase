"use client";

import {
  Attachment,
  AttachmentPreview,
  AttachmentRemove,
  Attachments,
} from "@/components/ai-elements/attachments";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
  MessageResponse,
  MessageToolbar,
} from "@/components/ai-elements/message";
import { TMessage } from "@/types";
import {
  CopyIcon,
  RefreshCcwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import { useState } from "react";

const Messages = ({
  messages,
  isWaitingResponse,
}: {
  messages: TMessage[];
  isWaitingResponse?: boolean;
}) => {
  const [liked, setLiked] = useState<Record<string, boolean>>({});
  const [disliked, setDisliked] = useState<Record<string, boolean>>({});

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
  };

  const handleRetry = () => {
    console.log("Retrying...");
  };

  return (
    <div className="flex flex-col gap-4">
      {/* biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Demo component with complex rendering logic */}
      {messages.map((message, index) => {
        const isLast = index === messages.length - 1;

        return (
          <Message from={message.from} key={message.key}>
            {message.versions?.length && message.versions.length >= 1 ? (
              <MessageBranch defaultBranch={0} key={message.key}>
                <MessageBranchContent>
                  {message.versions?.map((version) => (
                    <MessageContent key={version.id}>
                      <MessageResponse>{version.content}</MessageResponse>

                      {isLast &&
                        message.from === "assistant" &&
                        isWaitingResponse && (
                          <div className="mt-1 flex gap-1">
                            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-150" />
                            <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-300" />
                          </div>
                        )}
                    </MessageContent>
                  ))}
                </MessageBranchContent>
                {message.from === "assistant" && (
                  <MessageToolbar>
                    <MessageBranchSelector from={message.from}>
                      <MessageBranchPrevious />
                      <MessageBranchPage />
                      <MessageBranchNext />
                    </MessageBranchSelector>
                    <MessageActions>
                      <MessageAction
                        label="Retry"
                        onClick={handleRetry}
                        tooltip="Regenerate response"
                        className="hidden"
                      >
                        <RefreshCcwIcon className="size-4" />
                      </MessageAction>
                      <MessageAction
                        label="Like"
                        onClick={() =>
                          setLiked((prev) => ({
                            ...prev,
                            [message.key]: !prev[message.key],
                          }))
                        }
                        tooltip="Like this response"
                        className="hidden"
                      >
                        <ThumbsUpIcon
                          className="size-4"
                          fill={liked[message.key] ? "currentColor" : "none"}
                        />
                      </MessageAction>
                      <MessageAction
                        label="Dislike"
                        onClick={() =>
                          setDisliked((prev) => ({
                            ...prev,
                            [message.key]: !prev[message.key],
                          }))
                        }
                        tooltip="Dislike this response"
                        className="hidden"
                      >
                        <ThumbsDownIcon
                          className="size-4"
                          fill={disliked[message.key] ? "currentColor" : "none"}
                        />
                      </MessageAction>
                      <MessageAction
                        label="Copy"
                        onClick={() =>
                          handleCopy(
                            message.versions?.find((v) => v.id)?.content || "",
                          )
                        }
                        tooltip="Copy to clipboard"
                      >
                        <CopyIcon className="size-4" />
                      </MessageAction>
                    </MessageActions>
                  </MessageToolbar>
                )}
              </MessageBranch>
            ) : (
              <div key={message.key}>
                {message.attachments && message.attachments.length > 0 && (
                  <Attachments className="mb-2" variant="grid">
                    {message.attachments.map((attachment) => (
                      <Attachment data={attachment} key={attachment.id}>
                        <AttachmentPreview />
                        <AttachmentRemove />
                      </Attachment>
                    ))}
                  </Attachments>
                )}
                <MessageContent>
                  {message.from === "assistant" ? (
                    <MessageResponse>{message.content}</MessageResponse>
                  ) : (
                    message.content
                  )}
                </MessageContent>

                {message.content && (
                  <MessageActions
                    className={
                      message.from === "user" ? "justify-end pt-2" : ""
                    }
                  >
                    <MessageAction
                      label="Copy"
                      onClick={() => handleCopy(message.content || "")}
                      tooltip="Copy to clipboard"
                    >
                      <CopyIcon className="size-4" />
                    </MessageAction>
                  </MessageActions>
                )}
                {message.from === "assistant" && message.versions && (
                  <MessageActions>
                    <MessageAction
                      label="Retry"
                      onClick={handleRetry}
                      tooltip="Regenerate response"
                      className="hidden"
                    >
                      <RefreshCcwIcon className="size-4" />
                    </MessageAction>
                    <MessageAction
                      label="Like"
                      onClick={() =>
                        setLiked((prev) => ({
                          ...prev,
                          [message.key]: !prev[message.key],
                        }))
                      }
                      tooltip="Like this response"
                      className="hidden"
                    >
                      <ThumbsUpIcon
                        className="size-4"
                        fill={liked[message.key] ? "currentColor" : "none"}
                      />
                    </MessageAction>
                    <MessageAction
                      label="Dislike"
                      onClick={() =>
                        setDisliked((prev) => ({
                          ...prev,
                          [message.key]: !prev[message.key],
                        }))
                      }
                      tooltip="Dislike this response"
                      className="hidden"
                    >
                      <ThumbsDownIcon
                        className="size-4"
                        fill={disliked[message.key] ? "currentColor" : "none"}
                      />
                    </MessageAction>
                    <MessageAction
                      label="Copy"
                      onClick={() => handleCopy(message.content || "")}
                      tooltip="Copy to clipboard"
                    >
                      <CopyIcon className="size-4" />
                    </MessageAction>
                  </MessageActions>
                )}
              </div>
            )}
          </Message>
        );
      })}
    </div>
  );
};

export default Messages;
