"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  isFetching?: boolean;
}

export default function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  isFetching,
}: Readonly<Props>) {
  // Only hide when there is genuinely nothing to show. A single page still
  // renders the range, so the list always says how many rows there are.
  if (total === 0) return null;

  const singlePage = totalPages <= 1;

  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);

  return (
    <div className="flex flex-col items-center gap-3 border-t pt-4 sm:flex-row sm:justify-between">
      <p className="text-xs text-muted-foreground tabular-nums">
        Showing {first}-{last} of {total}
      </p>

      <div className={`flex items-center gap-2 ${singlePage ? "hidden" : ""}`}>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page <= 1 || isFetching}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" />
          Previous
        </Button>

        <span className="px-2 text-sm text-muted-foreground tabular-nums">
          {page} / {totalPages}
        </span>

        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          disabled={page >= totalPages || isFetching}
          onClick={() => onPageChange(page + 1)}
        >
          Next
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
