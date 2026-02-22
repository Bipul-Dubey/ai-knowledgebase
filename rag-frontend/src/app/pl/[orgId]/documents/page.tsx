"use client";

import { FileText, Info, Settings } from "lucide-react";
import DocumentList from "@/components/documents/DocumentList";
import { UploadDocumentModal } from "@/components/documents/UploadDocument";
import { useTrainDocuments } from "@/hooks/useDocumentResources";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

const DocumentsPage = () => {
  const { mutate: trainDocs, isPending: isTrainPending } = useTrainDocuments();
  const [showInfo, setShowInfo] = useState(false);
  const canMaintainDoc = !useAuth().isMember;

  const onTrainClick = () => {
    handleTrain();
    setShowInfo(true);

    // Optional auto hide after 6 seconds
    setTimeout(() => setShowInfo(false), 6000);
  };

  const handleTrain = () => {
    trainDocs([]);
  };

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

            {canMaintainDoc && (
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full xl:w-auto">
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <UploadDocumentModal />
                  <Button
                    onClick={onTrainClick}
                    disabled={isTrainPending}
                    className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Settings
                      className={`h-4 w-4 ${
                        isTrainPending ? "animate-spin" : ""
                      }`}
                    />
                    {isTrainPending ? "Training..." : "Train Documents"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showInfo && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-800 shadow-sm mt-4">
          <div className="mt-0.5">
            <Info className="h-5 w-5 text-blue-600" />
          </div>

          <div className="flex-1">
            <p className="text-sm font-medium">
              Training has started for all selected documents.
            </p>
            <p className="text-sm text-blue-700/80">
              This may take a few minutes. You can continue using the app.
            </p>
          </div>
        </div>
      )}

      {/* Main content area - Full Width */}
      <main className="flex-1 w-full px-6 py-12">
        <DocumentList />
      </main>
    </div>
  );
};

export default DocumentsPage;
