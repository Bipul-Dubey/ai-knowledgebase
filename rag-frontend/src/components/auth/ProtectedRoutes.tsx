"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { FullScreenLoader } from "../common/FullScreenLoader";

export const ProtectedRoutes = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isAuthLoading, validatePrivateSession } = useAuth();

  useEffect(() => {
    validatePrivateSession();
  }, [validatePrivateSession]);

  if (isAuthLoading) {
    return <FullScreenLoader text="Loading your workspace…" />;
  }

  return <>{children}</>;
};
