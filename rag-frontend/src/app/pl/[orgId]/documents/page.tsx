"use client";

import { FileText } from "lucide-react";
import DocumentList from "@/components/documents/DocumentList";
import { useDocumentResources } from "@/hooks/useDocumentResources";
import { UploadDocumentModal } from "@/components/documents/UploadDocument";

const DocumentsPage = () => {
  const { data, isLoading, isError, refetch } = useDocumentResources();

  if (isLoading) {
    return (
      <div className="p-6 space-y-3">
        <div className="h-6 w-1/3 animate-pulse rounded bg-muted" />
        <div className="h-6 w-full animate-pulse rounded bg-muted" />
        <div className="h-6 w-full animate-pulse rounded bg-muted" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  if (isError) {
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
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No documents uploaded yet.
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-background">
      <div className="border-b bg-card/50">
        <div className="w-full px-6 py-6">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-orange-500/10 dark:bg-orange-500/20 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
                <p className="text-sm text-muted-foreground">
                  {`Manage your organization's knowledge base`}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full xl:w-auto">
              {/* Action Buttons */}
              <div className="flex gap-2">
                <UploadDocumentModal />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area - Full Width */}
      <main className="flex-1 w-full px-6 py-12">
        <DocumentList documents={data ?? []} />
      </main>
    </div>
  );
};

export default DocumentsPage;
