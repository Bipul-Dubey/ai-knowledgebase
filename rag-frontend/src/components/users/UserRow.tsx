"use client";

import { IUser, TUSER_STATUS } from "@/types/apis";
import RoleSelect from "./RoleSelect";
import UserActionsDropdown from "./UserActionsDropdown";
import { cn, getInitials } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUpdateUserRole } from "@/hooks/orgs_user";

// Explicit dark variants: the bare -100/-700 pairs were unreadable in dark mode.
const STATUS_STYLES: Record<TUSER_STATUS, string> = {
  active:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  pending:
    "bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  suspended: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

export default function UserRow({ user }: { user: IUser }) {
  const { isAdmin, user: currentUser } = useAuth();
  const isSelf = currentUser?.id === user.id;

  const { mutate: updateRole, isPending: isUpdatingRole } = useUpdateUserRole();

  // Matches the backend rule: owner only, never the owner's own role, never
  // your own. Anything else shows the role as a read-only badge.
  const canChangeRole = isAdmin && !isSelf && user.role !== "owner";

  return (
    <li className="flex flex-col gap-3 rounded-xl border p-4 transition-shadow hover:shadow-sm sm:flex-row sm:items-center sm:gap-4">
      {/* Identity */}
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
          {getInitials(user.name)}
        </div>

        <div className="min-w-0">
          <p className="font-medium">
            {/* break-words, not truncate: a cut-off email is unusable */}
            <span className="break-words">{user.name}</span>
            {isSelf && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                (you)
              </span>
            )}
          </p>
          <p className="text-sm text-muted-foreground break-words">
            {user.email}
          </p>
        </div>
      </div>

      {/* Role, status, actions */}
      <div className="flex flex-wrap items-center gap-2 border-t pt-3 sm:shrink-0 sm:border-0 sm:pt-0">
        {canChangeRole ? (
          <RoleSelect
            value={user.role}
            disabled={isUpdatingRole}
            onChange={(role) => {
              // "owner" is not selectable and the API rejects it; this also
              // narrows the type without a cast.
              if (role === "owner") return;
              updateRole({ userId: user.id, role });
            }}
          />
        ) : (
          <span className="rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize text-muted-foreground">
            {user.role}
          </span>
        )}

        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium capitalize",
            STATUS_STYLES[user.status],
          )}
        >
          {user.status}
        </span>

        {user.role === "owner" || isSelf ? null : (
          <span className="ml-auto sm:ml-0">
            <UserActionsDropdown user={user} />
          </span>
        )}
      </div>
    </li>
  );
}
