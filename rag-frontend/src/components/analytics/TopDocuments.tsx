"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStats } from "@/hooks/orgs_user";
import { FileText } from "lucide-react";

export default function TopDocuments() {
  const { data, isLoading, isError } = useDashboardStats();

  if (isLoading || isError || !data) return null;

  const documents = data.top_documents ?? [];
  const most = documents[0]?.citations ?? 0;

  return (
    <Card className="rounded-lg px-5 py-4">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="text-base font-medium">
          Most cited documents
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Which documents actually answer questions.
        </p>
      </CardHeader>

      <CardContent className="p-0">
        {documents.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No citations recorded yet. This fills in as questions are answered.
          </p>
        ) : (
          <ul className="space-y-3">
            {documents.map((doc) => (
              <li key={doc.title} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate" title={doc.title}>
                      {doc.title}
                    </span>
                  </span>
                  <span className="shrink-0 text-muted-foreground tabular-nums">
                    {doc.citations.toLocaleString()}
                  </span>
                </div>

                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: most > 0 ? `${(doc.citations / most) * 100}%` : "0%",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
