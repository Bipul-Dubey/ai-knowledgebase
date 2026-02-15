"use client";

import { useRef, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useUploadDocument } from "@/hooks/useDocumentResources";
import { cn } from "@/lib/utils";
import { DialogDescription } from "@radix-ui/react-dialog";

export function UploadDocumentModal() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const { mutate, isPending } = useUploadDocument();

  const handleUpload = () => {
    if (!file) return;

    mutate(
      {
        file,
        title: file.name, // Pass filename automatically
      },
      {
        onSuccess: () => {
          resetState();
          setOpen(false);
        },
      },
    );
  };

  const resetState = () => {
    setFile(null);
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

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            Upload Document
          </DialogTitle>

          <DialogDescription>Upload a document file.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={(e) => {
              const selected = e.target.files?.[0];
              if (selected) setFile(selected);
            }}
          />

          {/* Upload Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "border-2 border-dashed rounded-xl p-6",
              "flex flex-col items-center justify-center",
              "cursor-pointer transition-colors",
              file
                ? "border-green-500 bg-green-50 dark:bg-green-900/10"
                : "border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30",
            )}
          >
            {file ? (
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-primary" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium truncate max-w-xs">
                    {file.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Click to change file
                  </span>
                </div>
                <X
                  className="w-4 h-4 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                />
              </div>
            ) : (
              <>
                <Upload className="w-6 h-6 text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Click to upload file</p>
                <p className="text-xs text-muted-foreground">PDF, DOC, etc.</p>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>

            <Button onClick={handleUpload} disabled={!file || isPending}>
              {isPending ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
