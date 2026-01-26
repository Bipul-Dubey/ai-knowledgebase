"use client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  FileText,
  Trash2,
  Zap,
  X,
  MoreHorizontal,
  List,
  Grid,
  Search,
} from "lucide-react";
import { useState, useCallback } from "react";

interface Document {
  id: string;
  name: string;
  size: string;
  status: "untrained" | "training" | "active" | "trained";
  lastTrained?: string;
}

const initialDocuments: Document[] = [
  {
    id: "1",
    name: "Q3 Financial Report.pdf",
    size: "2.3 MB",
    status: "active",
    lastTrained: "Jan 24",
  },
  {
    id: "2",
    name: "Product Roadmap 2026.pptx",
    size: "1.8 MB",
    status: "untrained",
  },
  {
    id: "3",
    name: "Engineering OKRs.docx",
    size: "450 KB",
    status: "training",
  },
  {
    id: "4",
    name: "Customer Feedback.xlsx",
    size: "3.1 MB",
    status: "active",
    lastTrained: "Jan 22",
  },
  {
    id: "5",
    name: "Meeting Notes Jan.md",
    size: "120 KB",
    status: "untrained",
  },
];

export default function DocumentList() {
  const [documents, setDocuments] = useState(initialDocuments);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");

  const filteredDocuments = documents.filter(
    (doc) =>
      doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      doc.size.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  const getStatusBadge = (status: Document["status"]) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-emerald-500 text-sm px-3 py-1">Active</Badge>
        );
      case "training":
        return (
          <Badge className="bg-orange-500 animate-pulse text-sm px-3 py-1">
            Training
          </Badge>
        );
      case "trained":
        return <Badge className="bg-blue-500 text-sm px-3 py-1">Trained</Badge>;
      case "untrained":
      default:
        return (
          <Badge variant="outline" className="text-sm px-3 py-1">
            Train
          </Badge>
        );
    }
  };

  // Extracted toggleTrain logic
  const toggleTrain = useCallback((id: string) => {
    setDocuments((docs) => {
      return docs.map((doc) => {
        if (doc.id !== id) return doc;

        // Untrain if currently active
        if (doc.status === "active") {
          return { ...doc, status: "untrained" };
        }

        // Ignore while training
        if (doc.status === "training") {
          return doc;
        }

        // Start training for untrained / trained
        return { ...doc, status: "training" };
      });
    });
  }, []);

  const deleteDoc = useCallback((id: string) => {
    setDocuments((docs) => docs.filter((doc) => doc.id !== id));
  }, []);

  const buttonContent = (status: Document["status"]) => {
    if (status === "active") {
      return (
        <>
          <X className="w-4 h-4 mr-2" />
          Untrain
        </>
      );
    }
    return (
      <>
        <Zap className="w-4 h-4 mr-2" />
        Train
      </>
    );
  };

  const shouldShowTrainButton = (status: Document["status"]) => {
    return status === "untrained" || status === "active";
  };

  return (
    <div className="w-full space-y-4">
      {/* Readable header */}
      <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between p-0">
        <div className="text-base font-semibold text-foreground">
          {filteredDocuments.length} / {documents.length} documents
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
          <div className="relative flex-1 max-w-lg">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-11 pl-11 pr-4 text-base rounded-xl"
            />
          </div>
          <div className="flex gap-1">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
              className="h-11 w-11 p-0"
            >
              <Grid className="h-5 w-5" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
              className="h-11 w-11 p-0"
            >
              <List className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Readable document grid */}
      <div
        className={
          viewMode === "grid"
            ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            : "space-y-3"
        }
      >
        {filteredDocuments.map((doc) => (
          <div
            key={doc.id}
            className="group border border-border/70 hover:border-orange-400/70 hover:shadow-md bg-card/80 rounded-xl p-4 transition-all overflow-hidden"
          >
            <div className="space-y-3">
              {/* Top row: icon + name + menu */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  <div className="w-10 h-10 bg-orange-500/10 rounded-lg flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5 text-orange-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-base leading-6 truncate">
                      {doc.name}
                    </p>
                    <p className="text-sm text-muted-foreground">{doc.size}</p>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="h-10 w-10 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem
                      onClick={() => deleteDoc(doc.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete document
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Bottom row: status + action */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  {getStatusBadge(doc.status)}
                  {doc.status === "active" && doc.lastTrained && (
                    <span className="text-sm text-muted-foreground">
                      Trained {doc.lastTrained}
                    </span>
                  )}
                </div>

                {shouldShowTrainButton(doc.status) && (
                  <Button
                    size="sm"
                    variant={doc.status === "active" ? "outline" : "default"}
                    onClick={() => toggleTrain(doc.id)}
                    className="h-10 px-4 text-sm font-medium"
                  >
                    {buttonContent(doc.status)}
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Readable empty state */}
      {filteredDocuments.length === 0 && (
        <div className="p-12 border-2 border-dashed border-muted rounded-xl text-center bg-muted/30">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2 text-foreground">
            No documents found
          </h3>
          <p className="text-base text-muted-foreground">
            {searchTerm
              ? "Try different keywords or clear the search."
              : "Upload your first document to get started."}
          </p>
        </div>
      )}
    </div>
  );
}
