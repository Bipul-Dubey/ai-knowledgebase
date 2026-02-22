import { RoleGuard } from "@/components/auth/RoleGuard";
import React from "react";

const SettingsLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return (
    <RoleGuard allowedRoles={["owner", "maintainer"]}>{children}</RoleGuard>
  );
};

export default SettingsLayout;
