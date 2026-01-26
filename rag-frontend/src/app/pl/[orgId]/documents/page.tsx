import { FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import DocumentList from "@/components/documents/DocumentList";

const DocumentsPage = () => {
  const currentOrg = { id: "org_1", name: "Acme Corp" };

  return (
    <div className="flex flex-col bg-background">
      {/* Documents Header - Full Width */}
      <div className="border-b bg-card/50">
        <div className="w-full px-6 py-6">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
            {/* Left: Org + Page Title */}
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-orange-500/10 dark:bg-orange-500/20 rounded-xl flex items-center justify-center">
                <FileText className="w-6 h-6 text-orange-500" />
              </div>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
                <p className="text-sm text-muted-foreground">
                  {`Manage your organization's knowledge base`} •{" "}
                  {currentOrg.name}
                </p>
              </div>
            </div>

            {/* Right: Stats + Actions - Full Width */}
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full xl:w-auto">
              {/* Stats Bar */}
              <div className="flex items-center space-x-4 text-sm bg-muted/50 px-6 py-3 rounded-xl flex-1 xl:flex-none">
                <span className="font-medium">2,847 docs</span>
                <span>•</span>
                <span>95% indexed</span>
                <span>•</span>
                <span>12.4M vectors</span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button className="gap-2">
                  <Upload className="w-4 h-4" />
                  Upload
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area - Full Width */}
      <main className="flex-1 w-full px-6 py-12">
        <DocumentList />
      </main>
    </div>
  );
};

export default DocumentsPage;
