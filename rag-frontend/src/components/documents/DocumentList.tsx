"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Trash2, Zap, Search, Upload as UploadIcon } from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";
import {
  useDeleteDocument,
  useDocumentResources,
  useDocumentStats,
  useTrainDocuments,
} from "@/hooks/useDocumentResources";
import Pagination from "@/components/common/Pagination";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ViewDocumentButton } from "./ViewDocs";
import { useAuth } from "@/hooks/useAuth";
import {
  MAX_DOCUMENTS_PER_ORG,
  MAX_ORG_STORAGE_BYTES,
} from "@/constants/uploads";
import { TDOCUMENT_STATUS } from "@/types/apis";

const PAGE_SIZE = 10;

// Explicit dark variants: the bare -100/-700 pairs were unreadable in dark mode.
const STATUS_STYLES: Record<TDOCUMENT_STATUS, string> = {
  untrained: "bg-muted text-muted-foreground",
  training:
    "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300 animate-pulse",
  trained:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

const TRAIN_LABEL: Record<TDOCUMENT_STATUS, string> = {
  untrained: "Train",
  trained: "Retrain",
  failed: "Retry",
  training: "Training",
};

export default function DocumentList() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const canMaintainDoc = !useAuth().isMember;

  // Debounced: search is a database query now, not an array filter.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError, isFetching, refetch } =
    useDocumentResources({ page, limit: PAGE_SIZE, search });

  // Org-wide, so it stays correct no matter which page is shown.
  const { data: stats } = useDocumentStats();

  const { mutate: deleteDoc } = useDeleteDocument();
  const { mutate: trainDocs } = useTrainDocuments();

  const documents = data?.documents ?? [];
  const total = data?.total ?? 0;

  const usedCount = stats?.used_count ?? 0;
  const usedBytes = stats?.used_bytes ?? 0;
  const maxDocuments = stats?.max_documents ?? MAX_DOCUMENTS_PER_ORG;
  const maxBytes = stats?.max_storage_bytes ?? MAX_ORG_STORAGE_BYTES;

  if (isLoading && !data)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading documents...
      </div>
    );

  if (isError)
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-destructive">Failed to load documents.</p>
        <button
          onClick={() => refetch()}
          className="text-sm underline text-muted-foreground hover:text-foreground"
        >
          Retry
        </button>
      </div>
    );

  return (
    <div className="w-full space-y-5">
      {/* Toolbar: stacks on phones, inline from sm up */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-base font-semibold">
            {search
              ? `${total} ${total === 1 ? "match" : "matches"}`
              : `${usedCount} of ${maxDocuments} documents`}
          </p>
          <p className="text-xs text-muted-foreground">
            {formatFileSize(usedBytes)} of {formatFileSize(maxBytes)} used
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search documents..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-12 text-center">
          <UploadIcon className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">
            {search ? "No matching documents" : "No documents yet"}
          </p>
          <p className="text-xs text-muted-foreground">
            {search
              ? "Try a different search term."
              : "Upload a PDF, Word, Excel or text file to get started."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className={cn(
                "rounded-xl border bg-card p-4 transition-shadow hover:shadow-sm",
                // Single column on phones; one row from md up.
                "flex flex-col gap-3 md:flex-row md:items-center md:gap-4",
              )}
            >
              {/* Identity */}
              <div className="flex min-w-0 flex-1 items-start gap-3 md:items-center">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/10">
                  <FileText className="size-5 text-orange-500" />
                </div>

                <div className="min-w-0">
                  {/* break-words, not truncate: the end of a filename is
                      usually what distinguishes it */}
                  <p
                    className="text-sm font-semibold break-words line-clamp-2"
                    title={doc.file_name}
                  >
                    {doc.file_name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatFileSize(doc.file_size)}
                  </p>
                </div>
              </div>

              {/* Status + actions. Separated by a rule on phones only,
                  where they sit under the name rather than beside it. */}
              <div className="flex flex-wrap items-center gap-2 border-t pt-3 md:shrink-0 md:border-0 md:pt-0">
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize",
                    STATUS_STYLES[doc.status],
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {doc.status}
                </span>

                <ViewDocumentButton documentId={doc.id} />

                {canMaintainDoc && (
                  <>
                    <Button
                      size="sm"
                      variant={
                        doc.status === "untrained" ? "default" : "outline"
                      }
                      disabled={doc.status === "training"}
                      className={cn(
                        "gap-1.5",
                        doc.status === "failed" &&
                          "border-destructive/50 text-destructive hover:bg-destructive/10",
                      )}
                      onClick={() => trainDocs([doc.id])}
                    >
                      <Zap className="size-3.5" />
                      {TRAIN_LABEL[doc.status]}
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Delete ${doc.file_name}`}
                          className="ml-auto text-muted-foreground hover:text-destructive md:ml-0"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>

                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            {`Delete "${doc.file_name}"?`}
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This also removes the stored file and everything
                            indexed from it. It cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>

                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteDoc(doc.id)}
                            className="bg-destructive hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        page={data?.page ?? page}
        totalPages={data?.total_pages ?? 0}
        total={total}
        limit={data?.limit ?? PAGE_SIZE}
        onPageChange={setPage}
        isFetching={isFetching}
      />
    </div>
  );
}
