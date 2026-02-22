"use client";

import { PATHS } from "@/constants/paths";
import { IOrganizationDetails, IUser } from "@/types/apis";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { createContext, ReactNode, useState } from "react";

type TNullableUser = IUser | null;
type TNullableOrganization = IOrganizationDetails | null;

export interface AuthContextType {
  user: TNullableUser;
  organization: TNullableOrganization;
  handleSetUser: (user: TNullableUser) => void;
  handleSetOrganization: (org: TNullableOrganization) => void;
  logout: () => void;
  isAdmin: boolean;
  isMaintainer: boolean;
  isMember: boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

interface Props {
  children: ReactNode;
}

const initRole = {
  isAdmin: false,
  isMaintainer: false,
  isMember: false,
};

export const AuthProvider = ({ children }: Props) => {
  const [user, setUser] = useState<TNullableUser>(null);
  const [organization, setOrganization] = useState<TNullableOrganization>(null);
  const [role, setRole] = useState<{
    isAdmin: boolean;
    isMaintainer: boolean;
    isMember: boolean;
  }>(initRole);

  const router = useRouter();
  const queryClient = useQueryClient();

  const handleSetUser = (user: TNullableUser) => {
    setUser(user);
    if (user) {
      const role = user.role;
      setRole({
        isAdmin: role === "owner",
        isMaintainer: role === "maintainer",
        isMember: role === "member",
      });
    } else {
      setRole(initRole);
    }
  };

  const handleSetOrganization = (org: TNullableOrganization) => {
    setOrganization(org);
  };

  const logout = async () => {
    setUser(null);
    setOrganization(null);

    await queryClient.cancelQueries();

    // Remove everything except document-download-url
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] !== "document-download-url",
    });

    localStorage.clear();

    router.replace(PATHS.pl.LOGIN);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        handleSetUser,
        organization,
        handleSetOrganization,
        logout,
        ...role,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
