"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PATHS } from "@/constants/paths";
import { FullScreenLoader } from "../common/FullScreenLoader";
import { useOrganizationDetails } from "@/hooks/orgs_user";

export const ProtectedRoutes = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const router = useRouter();
  const hasRunRef = useRef(false);
  const [authDone, setAuthDone] = useState(false);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const { refetch } = useOrganizationDetails();

  useEffect(() => {
    if (hasRunRef.current) return;
    hasRunRef.current = true;

    if (!token) {
      router.replace(PATHS.pl.LOGIN);
      return;
    }

    const validate = async () => {
      try {
        const res = await refetch();

        if (!res.data || res.data.error || !res.data.data) {
          throw new Error("Invalid session");
        }

        setAuthDone(true);
      } catch {
        localStorage.removeItem("access_token");
        router.replace(PATHS.pl.LOGIN);
      }
    };

    validate();
  }, [token, refetch, router]);

  return (
    <>
      {children}
      {!authDone && <FullScreenLoader text="Loading your workspace…" />}
    </>
  );
};
