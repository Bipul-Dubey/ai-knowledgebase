"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PATHS } from "@/constants/paths";
import { FullScreenLoader } from "../common/FullScreenLoader";
import { useCurrentUser, useOrganizationDetails } from "@/hooks/orgs_user";
import { useAuth } from "@/hooks/useAuth";

export const ProtectedRoutes = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const router = useRouter();
  const hasRunRef = useRef(false);
  const [authDone, setAuthDone] = useState(false);
  const { handleSetOrganization, handleSetUser } = useAuth();

  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const { refetch } = useOrganizationDetails();
  const { refetch: refetchUser } = useCurrentUser();

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

        const orgData = res?.data?.data;

        if (!res.data || res.data.error || !orgData) {
          throw new Error("Invalid session");
        }
        if (orgData) {
          handleSetOrganization(orgData);
          const resUser = await refetchUser();
          handleSetUser(resUser?.data?.data ?? null);
        } else {
          handleSetOrganization(null);
          handleSetUser(null);
        }

        setAuthDone(true);
      } catch {
        localStorage.removeItem("access_token");
        router.replace(PATHS.pl.LOGIN);
      }
    };

    validate();
  }, [
    token,
    refetch,
    router,
    handleSetOrganization,
    refetchUser,
    handleSetUser,
  ]);

  return (
    <>
      {children}
      {!authDone && <FullScreenLoader text="Loading your workspace…" />}
    </>
  );
};
