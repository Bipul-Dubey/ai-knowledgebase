"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Trash2, Zap, List, Grid, Search, Info } from "lucide-react";
import { cn, formatFileSize } from "@/lib/utils";
import {
  useDeleteDocument,
  useDocumentResources,
  useTrainDocuments,
} from "@/hooks/useDocumentResources";
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

export default function DocumentList() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");
  const [trainingDocId, setTrainingDocId] = useState<string | null>(null);
  const canMaintainDoc = !useAuth().isMember;

  const {
    data: documents = [],
    isLoading,
    isError,
    refetch,
  } = useDocumentResources();

  const { mutate: deleteDoc } = useDeleteDocument();
  const { mutate: trainDocs } = useTrainDocuments();

  const onTrainClick = (docId: string) => {
    setTrainingDocId(docId);

    trainDocs([docId], {
      onSettled: () => {
        setTimeout(() => setTrainingDocId(null), 4000);
      },
    });
  };

  const handleDelete = (id: string) => {
    deleteDoc(id);
  };

  const filteredDocuments = documents.filter((doc) =>
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (isLoading)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Loading documents...
      </div>
    );

  if (isError)
    return (
      <div className="p-6 text-center space-y-3">
        <p className="text-sm text-red-500">Failed to load documents.</p>
        <button
          onClick={() => refetch()}
          className="text-sm underline text-muted-foreground hover:text-foreground"
        >
          Retry
        </button>
      </div>
    );

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row gap-4 lg:items-center justify-between">
        <div className="text-lg font-semibold">
          {filteredDocuments.length} / {documents.length} documents
        </div>

        <div className="flex gap-2 items-center">
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("grid")}
          >
            <Grid className="h-4 w-4" />
          </Button>

          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("list")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Document Grid / List */}
      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
            : "space-y-4"
        }
      >
        {filteredDocuments.map((doc) => (
          <div
            key={doc.id}
            className="border rounded-xl p-5 bg-card hover:shadow-md transition-all space-y-4"
          >
            {/* File Info */}
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                <FileText className="w-5 h-5 text-orange-600" />
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{doc.file_name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(doc.file_size)}
                </p>
              </div>
            </div>

            {/* Status + Actions */}
            <div className="flex items-center justify-between">
              {/* Status Badge */}
              <span
                className={cn(
                  "flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-full capitalize",
                  doc.status === "untrained" &&
                    "bg-muted text-muted-foreground",
                  doc.status === "training" &&
                    "bg-orange-100 text-orange-700 animate-pulse",
                  doc.status === "trained" && "bg-blue-100 text-blue-700",
                  doc.status === "failed" && "bg-red-100 text-red-700",
                )}
              >
                <span className="w-2 h-2 rounded-full bg-current" />
                {doc.status}
              </span>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* view icon */}
                <ViewDocumentButton documentId={doc.id} />
                {/* Train Button */}
                {canMaintainDoc &&
                  (doc.status === "training" ? (
                    <Button size="sm" disabled>
                      <Zap className="w-4 h-4 mr-1" />
                      Training...
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={
                        doc.status === "untrained" ? "default" : "outline"
                      }
                      className={cn(
                        doc.status === "failed" &&
                          "border-red-500 text-red-600 hover:bg-red-50",
                      )}
                      onClick={() => onTrainClick(doc.id)}
                    >
                      <Zap className="w-4 h-4 mr-1" />
                      {doc.status === "untrained" && "Train"}
                      {doc.status === "trained" && "Retrain"}
                      {doc.status === "failed" && "Retry"}
                    </Button>
                  ))}

                {/* Delete */}
                {canMaintainDoc && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>

                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {`Delete "${doc.file_name}"?`}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>

                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(doc.id)}
                          className="bg-destructive hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>

            {/* Training Info Banner */}
            {trainingDocId === doc.id && (
              <div className="flex items-start gap-2 rounded-md bg-blue-50 border border-blue-200 p-3 text-blue-700 text-sm">
                <Info className="w-4 h-4 mt-0.5" />
                Training has started for this document. It will complete
                shortly.
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredDocuments.length === 0 && (
        <div className="p-12 border-2 border-dashed rounded-xl text-center text-muted-foreground">
          No documents found.
        </div>
      )}
    </div>
  );
}
