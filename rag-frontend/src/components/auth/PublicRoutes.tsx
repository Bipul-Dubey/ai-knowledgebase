"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PATHS } from "@/constants/paths";
import { FullScreenLoader } from "../common/FullScreenLoader";
import { useOrganizationDetails } from "@/hooks/orgs_user";

export const PublicRoutes = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  const { refetch } = useOrganizationDetails();

  useEffect(() => {
    setToken(localStorage.getItem("access_token"));
  }, []);

  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    const redirectToOrg = async () => {
      try {
        const res = await refetch();
        if (!cancelled && res.data && !res.data.error && res.data.data) {
          router.replace(PATHS.pl.DASHBOARD(res.data.data.organization_id));
        } else {
          router.replace(PATHS.pl.LOGIN);
          localStorage.removeItem("access_token");
        }
      } catch {
        router.replace(PATHS.pl.LOGIN);
        localStorage.removeItem("access_token");
      } finally {
        if (!cancelled) setChecking(false);
      }
    };

    redirectToOrg();

    return () => {
      cancelled = true;
    };
  }, [token, refetch, router]);

  return (
    <>
      {children}
      {checking && <FullScreenLoader text="Checking your session…" />}
    </>
  );
};
