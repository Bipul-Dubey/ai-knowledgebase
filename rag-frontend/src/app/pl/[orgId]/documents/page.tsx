"use client";

import { FileText, Info, Settings } from "lucide-react";
import DocumentList from "@/components/documents/DocumentList";
import { UploadDocumentModal } from "@/components/documents/UploadDocument";
import { useTrainDocuments } from "@/hooks/useDocumentResources";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const DocumentsPage = () => {
  const { mutate: trainDocs, isPending: isTrainPending } = useTrainDocuments();
  const [showInfo, setShowInfo] = useState(false);
  const canMaintainDoc = !useAuth().isMember;

  // Clear the timer on unmount, so leaving the page mid-countdown does not
  // set state on a component that is gone.
  useEffect(() => {
    if (!showInfo) return;
    const timer = setTimeout(() => setShowInfo(false), 6000);
    return () => clearTimeout(timer);
  }, [showInfo]);

  const onTrainClick = () => {
    trainDocs([]);
    setShowInfo(true);
  };

  return (
    <div className="flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card/50">
        <div className="w-full px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/10 sm:size-12">
                <FileText className="size-5 text-orange-500 sm:size-6" />
              </div>
              <div className="min-w-0">
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                  Documents
                </h1>
                <p className="text-sm text-muted-foreground">
                  {`Manage your organization's knowledge base`}
                </p>
              </div>
            </div>

            {canMaintainDoc && (
              // Full-width buttons on phones, natural width from sm up.
              <div className="grid grid-cols-2 gap-2 sm:flex sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
                <UploadDocumentModal />
                <Button
                  onClick={onTrainClick}
                  disabled={isTrainPending}
                  className="gap-2"
                >
                  <Settings
                    className={`size-4 ${isTrainPending ? "animate-spin" : ""}`}
                  />
                  {isTrainPending ? "Training..." : "Train all"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showInfo && (
        <div className="mx-4 mt-4 flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sky-900 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200 sm:mx-6">
          <Info className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-sm font-medium">
              Training started for all untrained documents.
            </p>
            <p className="text-sm opacity-80">
              Status updates here as each one finishes.
            </p>
          </div>
        </div>
      )}

      <main className="flex-1 w-full px-4 py-6 sm:px-6 sm:py-8">
        <DocumentList />
      </main>
    </div>
  );
};

export default DocumentsPage;
