"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PATHS } from "@/constants/paths";
import { FullScreenLoader } from "../common/FullScreenLoader";

export const PublicRoutes = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();

  // Read token synchronously
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  // Redirect as a side-effect
  useEffect(() => {
    if (token) {
      router.replace(PATHS.pl.DASHBOARD);
    }
  }, [token, router]);

  // While redirecting
  if (token) {
    return <FullScreenLoader text="Checking your session…" />;
  }

  // No token → allow public route
  return <>{children}</>;
};
