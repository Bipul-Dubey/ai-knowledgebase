"use client";

import { useAuth } from "@/hooks/useAuth";
import { TUSER_ROLE } from "@/types/apis";
import { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "../ui/button";
import { useRouter } from "next/navigation";
import { PATHS } from "@/constants/paths";

interface RoleGuardProps {
  allowedRoles: TUSER_ROLE[];
  children: ReactNode;
  fallback?: ReactNode;
}

export const RoleGuard = ({
  allowedRoles,
  children,
  fallback,
}: RoleGuardProps) => {
  const { user, organization } = useAuth();
  const router = useRouter();

  if (!user || !allowedRoles.includes(user.role ?? "")) {
    return (
      fallback ?? (
        <div className="flex min-h-[70vh] items-center justify-center px-4">
          <div className="max-w-md w-full text-center space-y-6">
            <div className="flex justify-center">
              <div className="p-4 rounded-full bg-destructive/10">
                <ShieldAlert className="w-10 h-10 text-destructive" />
              </div>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Access Restricted
              </h1>
              <p className="text-muted-foreground text-sm">
                You do not have permission to view this page. Please contact
                your organization administrator if you believe this is a
                mistake.
              </p>
            </div>

            <div className="flex justify-center gap-3">
              <Button
                onClick={() =>
                  router.push(
                    PATHS.pl.DASHBOARD(organization?.organization_id ?? ""),
                  )
                }
              >
                Go to Dashboard
              </Button>
            </div>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
};
