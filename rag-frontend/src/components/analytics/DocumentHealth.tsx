"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useDashboardStats } from "@/hooks/orgs_user";
import { AlertTriangle } from "lucide-react";

type Segment = {
  label: string;
  count: number;
  bar: string;
  dot: string;
};

export default function DocumentHealth() {
  const { data, isLoading, isError } = useDashboardStats();

  if (isLoading || isError || !data) return null;

  const segments: Segment[] = [
    {
      label: "Trained",
      count: data.documents_trained,
      bar: "bg-emerald-500",
      dot: "bg-emerald-500",
    },
    {
      label: "Training",
      count: data.documents_training,
      bar: "bg-sky-500",
      dot: "bg-sky-500",
    },
    {
      label: "Untrained",
      count: data.documents_untrained,
      bar: "bg-muted-foreground/40",
      dot: "bg-muted-foreground/40",
    },
    {
      label: "Failed",
      count: data.documents_failed,
      bar: "bg-destructive",
      dot: "bg-destructive",
    },
  ];

  const total = segments.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card className="rounded-lg px-5 py-4">
      <CardHeader className="p-0 mb-4">
        <CardTitle className="text-base font-medium">
          Document index health
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Only trained documents can be searched.
        </p>
      </CardHeader>

      <CardContent className="p-0 space-y-4">
        {total === 0 ? (
          <p className="text-sm text-muted-foreground">
            No documents uploaded yet.
          </p>
        ) : (
          <>
            {/* Proportions at a glance */}
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
              {segments
                .filter((s) => s.count > 0)
                .map((s) => (
                  <div
                    key={s.label}
                    className={s.bar}
                    style={{ width: `${(s.count / total) * 100}%` }}
                    title={`${s.label}: ${s.count}`}
                  />
                ))}
            </div>

            <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
              {segments.map((s) => (
                <li
                  key={s.label}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <span className={`size-2 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                  <span className="font-medium tabular-nums">{s.count}</span>
                </li>
              ))}
            </ul>

            {data.documents_failed > 0 && (
              <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                <p className="text-xs text-destructive">
                  {data.documents_failed}{" "}
                  {data.documents_failed === 1 ? "document" : "documents"}{" "}
                  failed to index and {data.documents_failed === 1 ? "is" : "are"}{" "}
                  not searchable. Retry from the Documents page.
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
