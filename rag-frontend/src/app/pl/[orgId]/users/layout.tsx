import { RoleGuard } from "@/components/auth/RoleGuard";
import React from "react";

const UserLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <RoleGuard allowedRoles={["maintainer", "owner"]}>{children}</RoleGuard>
  );
};

export default UserLayout;
