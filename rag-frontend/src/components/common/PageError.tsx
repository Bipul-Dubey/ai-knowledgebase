"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PageErrorProps {
  message?: string;
  onRetry?: () => void;
}

export default function PageError({
  message = "Something went wrong.",
  onRetry,
}: Readonly<PageErrorProps>) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
      <AlertCircle className="w-8 h-8 text-destructive" />

      <p className="text-sm text-muted-foreground">{message}</p>

      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Retry
        </Button>
      )}
    </div>
  );
}
