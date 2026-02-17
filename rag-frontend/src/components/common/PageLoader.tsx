"use client";

import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  message?: string;
}

export default function PageLoader({
  message = "Loading...",
}: Readonly<PageLoaderProps>) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground space-y-3">
      <Loader2 className="w-6 h-6 animate-spin" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
