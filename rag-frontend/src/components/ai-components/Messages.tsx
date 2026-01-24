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
import {
  CopyIcon,
  RefreshCcwIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useState } from "react";

type TMessage = {
  key: string;
  from: "user" | "assistant";
  versions?: { id: string; content: string }[];
  content?: string;
  attachments?: {
    id: string;
    type: "file";
    url: string;
    mediaType: string;
    filename?: string;
  }[];
};

const messages: TMessage[] = [
  {
    key: nanoid(),
    from: "user",
    content: "How do React hooks work and when should I use them?",
    attachments: [
      {
        id: nanoid(),
        type: "file",
        url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=400&h=400&fit=crop",
        mediaType: "image/jpeg",
        filename: "palace-of-fine-arts.jpg",
      },
      {
        id: nanoid(),
        type: "file",
        url: "",
        mediaType: "application/pdf",
        filename: "react-hooks-guide.pdf",
      },
    ],
  },
  {
    key: nanoid(),
    from: "assistant",
    versions: [
      {
        id: nanoid(),
        content: `# React Hooks Guide

React hooks are functions that let you "hook into" React state and lifecycle features from function components. Here's what you need to know:

## Core Hooks

### useState
Adds state to functional components:

\`\`\`jsx
const [count, setCount] = useState(0);

return (
  <button onClick={() => setCount(count + 1)}>
    Count: {count}
  </button>
);
\`\`\`

### useEffect
Handles side effects (data fetching, subscriptions, DOM updates):

\`\`\`jsx
useEffect(() => {
  document.title = \`You clicked \${count} times\`;

  // Cleanup function (optional)
  return () => {
    document.title = 'React App';
  };
}, [count]); // Dependency array
\`\`\`

## When to Use Hooks

- ✅ **Function components** - Hooks only work in function components
- ✅ **Replacing class components** - Modern React favors hooks over classes
- ✅ **Sharing stateful logic** - Create custom hooks to reuse logic
- ❌ **Class components** - Use lifecycle methods instead

## Rules of Hooks

1. Only call hooks at the **top level** (not inside loops, conditions, or nested functions)
2. Only call hooks from **React functions** (components or custom hooks)

Would you like to explore more advanced hooks like \`useCallback\` or \`useMemo\`?`,
      },
      {
        id: nanoid(),
        content: `# React Hooks Guide

React hooks are functions that let you "hook into" React state and lifecycle features from function components. Here's what you need to know:

## Core Hooks

### useState
Adds state to functional components:

\`\`\`jsx
const [count, setCount] = useState(0);

return (
  <button onClick={() => setCount(count + 1)}>
    Count: {count}
  </button>
);
\`\`\`

### useEffect
Handles side effects (data fetching, subscriptions, DOM updates):

\`\`\`jsx
useEffect(() => {
  document.title = \`You clicked \${count} times\`;

  // Cleanup function (optional)
  return () => {
    document.title = 'React App';
  };
}, [count]); // Dependency array
\`\`\`

## When to Use Hooks

- ✅ **Function components** - Hooks only work in function components
- ✅ **Replacing class components** - Modern React favors hooks over classes
- ✅ **Sharing stateful logic** - Create custom hooks to reuse logic
- ❌ **Class components** - Use lifecycle methods instead

## Rules of Hooks

1. Only call hooks at the **top level** (not inside loops, conditions, or nested functions)
2. Only call hooks from **React functions** (components or custom hooks)

Would you like to explore more advanced hooks like \`useCallback\` or \`useMemo\`?`,
      },
    ],
  },
  {
    key: nanoid(),
    from: "user",
    content: "hello i am user",
  },
];

const Messages = () => {
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
      {messages.map((message) => (
        <Message from={message.from} key={message.key}>
          {message.versions?.length && message.versions.length >= 1 ? (
            <MessageBranch defaultBranch={0} key={message.key}>
              <MessageBranchContent>
                {message.versions?.map((version) => (
                  <MessageContent key={version.id}>
                    <MessageResponse>{version.content}</MessageResponse>
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
                  className={message.from === "user" ? "justify-end pt-2" : ""}
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
      ))}
    </div>
  );
};

export default Messages;
