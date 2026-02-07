"use client";

import {
  createContext,
  useEffect,
  useState,
  ReactNode,
  useMemo,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import { PATHS } from "@/constants/paths";
import { useOrganizationDetails } from "@/hooks/orgs_user";
import { OrganizationDetails } from "@/types/apis";

interface AuthContextType {
  isLoggedIn: boolean;
  isAuthLoading: boolean;
  logout: () => void;
  orgs: OrganizationDetails | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [orgs, setOrgs] = useState<OrganizationDetails | null>(null);

  const { refetch, isFetching } = useOrganizationDetails();

  // Load token once
  useEffect(() => {
    setToken(localStorage.getItem("access_token"));
  }, []);

  const checkAuth = useCallback(async () => {
    setIsAuthLoading(true);

    if (!token) {
      setIsLoggedIn(false);
      setOrgs(null);
      setIsAuthLoading(false);
      return;
    }

    try {
      const res = await refetch();

      if (res.data && !res.data.error && res.data.data) {
        setIsLoggedIn(true);
        setOrgs(res.data.data);
      } else {
        throw new Error("Invalid session");
      }
    } catch {
      localStorage.removeItem("access_token");
      setToken(null);
      setIsLoggedIn(false);
      setOrgs(null);
      router.replace(PATHS.pl.LOGIN);
    } finally {
      setIsAuthLoading(false);
    }
  }, [token, refetch, router]);

  // Run ONLY when token changes
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const logout = useCallback(() => {
    localStorage.removeItem("access_token");
    setToken(null);
    setIsLoggedIn(false);
    setOrgs(null);
    router.replace(PATHS.pl.LOGIN);
  }, [router]);

  const contextValue = useMemo(
    () => ({
      isLoggedIn,
      isAuthLoading: isAuthLoading || isFetching,
      logout,
      orgs,
    }),
    [isLoggedIn, isAuthLoading, isFetching, logout, orgs],
  );

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
