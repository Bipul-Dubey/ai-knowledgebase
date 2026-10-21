"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { TSource } from "@/types";
import { ChevronRightIcon, FileTextIcon } from "lucide-react";
import { useState } from "react";

const pageLabel = (pages?: number[]) => {
  if (!pages?.length) return null;
  return `${pages.length === 1 ? "Page" : "Pages"} ${pages.join(", ")}`;
};

const MessageSources = ({ sources }: { sources?: TSource[] }) => {
  const [open, setOpen] = useState(false);

  if (!sources?.length) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3">
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRightIcon
          className={`size-3.5 transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
        />
        {sources.length} {sources.length === 1 ? "source" : "sources"}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <ul className="mt-2 flex flex-col gap-2 border-l-2 border-border pl-3">
          {sources.map((source) => {
            const label = pageLabel(source.pages);

            return (
              <li className="flex items-start gap-2 text-xs" key={source.id}>
                <FileTextIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="break-words font-medium text-foreground">
                    {source.title}
                  </p>
                  {label && <p className="text-muted-foreground">{label}</p>}
                </div>
              </li>
            );
          })}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
};

export default MessageSources;
