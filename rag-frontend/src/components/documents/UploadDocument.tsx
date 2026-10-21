"use client";

import { useRef, useState } from "react";
import { AlertCircle, FileText, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useDocumentStats,
  useUploadDocuments,
} from "@/hooks/useDocumentResources";
import { cn, formatFileSize } from "@/lib/utils";
import {
  MAX_DOCUMENTS_PER_ORG,
  MAX_FILE_SIZE_BYTES,
  MAX_ORG_STORAGE_BYTES,
  UPLOAD_ACCEPT,
} from "@/constants/uploads";
import { RejectedFile, validateSelection } from "@/lib/upload-validation";
import { useSnackbar } from "notistack";
import axios from "axios";

function QuotaBar({
  label,
  used,
  total,
  display,
}: Readonly<{ label: string; used: number; total: number; display: string }>) {
  const pct = total > 0 ? Math.min((used / total) * 100, 100) : 0;
  const full = used >= total;

  return (
    <div className="flex-1 space-y-1.5">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn("tabular-nums", full && "text-destructive")}>
          {display}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            full ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function UploadDocumentModal() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [queued, setQueued] = useState<File[]>([]);
  const [rejected, setRejected] = useState<RejectedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  // Org-wide usage, not the current page of the list: summing one page
  // would under-count and let the org exceed its quota.
  const { data: stats } = useDocumentStats();
  const { mutate, isPending } = useUploadDocuments();
  const { enqueueSnackbar } = useSnackbar();

  const usedCount = stats?.used_count ?? 0;
  const usedBytes = stats?.used_bytes ?? 0;

  // Limits come from the API, with the local constants as a fallback for
  // the first render before stats land.
  const maxDocuments = stats?.max_documents ?? MAX_DOCUMENTS_PER_ORG;
  const maxBytes = stats?.max_storage_bytes ?? MAX_ORG_STORAGE_BYTES;
  const maxFileSize = stats?.max_file_size_bytes ?? MAX_FILE_SIZE_BYTES;

  const queuedBytes = queued.reduce((sum, file) => sum + file.size, 0);
  const atCapacity = usedCount + queued.length >= maxDocuments;

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;

    const result = validateSelection(incoming, queued, usedCount, usedBytes);
    setQueued((prev) => [...prev, ...result.accepted]);
    // Replace rather than append: these belong to the latest selection.
    setRejected(result.rejected);
  };

  const removeFile = (name: string) =>
    setQueued((prev) => prev.filter((file) => file.name !== name));

  const resetState = () => {
    setQueued([]);
    setRejected([]);
    setIsDragging(false);
  };

  const handleUpload = () => {
    if (queued.length === 0) return;

    mutate(queued, {
      onSuccess: (result) => {
        if (result.rejected?.length) {
          enqueueSnackbar(
            `${result.rejected.length} file(s) were rejected by the server`,
            { variant: "warning" },
          );
          setRejected(
            result.rejected.map((item) => ({
              file: { name: item.file_name, size: 0 } as File,
              reason: item.reason,
            })),
          );
          setQueued([]);
          return;
        }

        enqueueSnackbar(
          `${result.uploaded.length} document(s) uploaded`,
          { variant: "success" },
        );
        resetState();
        setOpen(false);
      },
      onError: (error: unknown) => {
        let message = "Upload failed";

        if (axios.isAxiosError<{ message?: string }>(error)) {
          message = error.response?.data?.message ?? message;
        }

        enqueueSnackbar(message, { variant: "error" });
      },
    });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) resetState();
      }}
    >
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Upload className="w-4 h-4" />
          Upload
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload documents</DialogTitle>
          <DialogDescription>
            PDF, Word, Excel or text files. Up to{" "}
            {formatFileSize(maxFileSize)} each.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* Quota, so limits are visible before picking rather than after */}
          <div className="flex flex-col sm:flex-row gap-4 rounded-lg border bg-muted/30 p-3">
            <QuotaBar
              label="Documents"
              used={usedCount + queued.length}
              total={maxDocuments}
              display={`${usedCount + queued.length} / ${maxDocuments}`}
            />
            <QuotaBar
              label="Storage"
              used={usedBytes + queuedBytes}
              total={maxBytes}
              display={`${formatFileSize(usedBytes + queuedBytes)} / ${formatFileSize(
                maxBytes,
              )}`}
            />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={UPLOAD_ACCEPT}
            className="hidden"
            onChange={(e) => {
              addFiles(Array.from(e.target.files ?? []));
              // Reset so picking the same file again still fires onChange.
              e.target.value = "";
            }}
          />

          {/* Drop zone */}
          <button
            type="button"
            disabled={atCapacity}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              if (!atCapacity) setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (!atCapacity) addFiles(Array.from(e.dataTransfer.files));
            }}
            className={cn(
              "w-full rounded-xl border-2 border-dashed px-6 py-10",
              "flex flex-col items-center justify-center gap-2 text-center",
              "transition-colors",
              atCapacity
                ? "cursor-not-allowed border-muted opacity-60"
                : "cursor-pointer hover:border-primary/50 hover:bg-muted/30",
              isDragging && "border-primary bg-primary/5",
            )}
          >
            <Upload className="size-6 text-muted-foreground" />
            {atCapacity ? (
              <p className="text-sm font-medium">
                Document limit reached. Delete one to add more.
              </p>
            ) : (
              <>
                <p className="text-sm font-medium">
                  Drop files here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground">
                  PDF, DOCX, XLSX, TXT, MD, CSV
                </p>
              </>
            )}
          </button>

          {/* Rejected, with the reason for each */}
          {rejected.length > 0 && (
            <ul className="space-y-1.5 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              {rejected.map((item) => (
                <li
                  key={item.file.name}
                  className="flex items-start gap-2 text-xs"
                >
                  <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive" />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium break-words">
                      {item.file.name}
                    </span>
                    <span className="text-destructive"> - {item.reason}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          {/* Staged files */}
          {queued.length > 0 && (
            <ul className="divide-y rounded-lg border">
              {queued.map((file) => (
                <li
                  key={file.name}
                  className="flex items-center gap-3 p-3 text-sm"
                >
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate" title={file.name}>
                    {file.name}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                    {formatFileSize(file.size)}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(file.name)}
                    disabled={isPending}
                    aria-label={`Remove ${file.name}`}
                    className="shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-50"
                  >
                    <X className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>

            <Button
              onClick={handleUpload}
              disabled={queued.length === 0 || isPending}
            >
              {isPending
                ? "Uploading..."
                : `Upload${queued.length > 0 ? ` ${queued.length}` : ""}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
