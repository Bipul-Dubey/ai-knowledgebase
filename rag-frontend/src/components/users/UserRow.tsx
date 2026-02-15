"use client";

import { IUser } from "@/types/apis";
import RoleSelect from "./RoleSelect";
import UserActionsDropdown from "./UserActionsDropdown";
import { cn } from "@/lib/utils";

export default function UserRow({ user }: { user: IUser }) {
  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 border rounded-xl hover:shadow-sm transition-all">
      {/* Left Side */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-semibold text-sm">
          {initials}
        </div>

        <div className="min-w-0">
          <p className="font-medium truncate">{user.name}</p>
          <p className="text-sm text-muted-foreground truncate">{user.email}</p>
        </div>
      </div>

      {/* Right Side */}
      <div className="flex flex-wrap items-center gap-3">
        <RoleSelect
          value={user.role}
          disabled={
            user.role === "owner" ||
            ["pending", "suspended"].includes(user.status)
          }
          onChange={(val) => console.log("Role change:", val)}
        />

        {/* Status Badge */}
        <span
          className={cn(
            "px-3 py-1 text-xs rounded-full capitalize font-medium",
            user.status === "active" && "bg-emerald-100 text-emerald-700",
            user.status === "pending" && "bg-orange-100 text-orange-700",
            user.status === "suspended" && "bg-red-100 text-red-700",
          )}
        >
          {user.status}
        </span>

        {user.role === "owner" ? null : (
          <UserActionsDropdown
            status={user.status}
            onResend={() => console.log("Resend")}
            onRemove={() => console.log("Remove")}
          />
        )}
      </div>
    </div>
  );
}
