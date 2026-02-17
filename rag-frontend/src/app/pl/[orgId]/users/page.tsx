"use client";

import { useState } from "react";
import InviteUserButton from "@/components/users/InviteUserButton";
import UserRow from "@/components/users/UserRow";
import UsersPagination from "@/components/users/UsersPagination";
import { useUsers } from "@/hooks/orgs_user";
import PageLoader from "@/components/common/PageLoader";
import PageError from "@/components/common/PageError";

export default function UsersPage() {
  const { data: users = [], isLoading, isError, refetch } = useUsers();
  const [page, setPage] = useState(1);

  if (isLoading) return <PageLoader message="Loading users..." />;

  if (isError)
    return <PageError message="Failed to load users." onRetry={refetch} />;

  return (
    <div className="flex flex-col bg-background">
      <div className="border-b bg-card/50 px-6 py-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage organization members
          </p>
        </div>

        <InviteUserButton />
      </div>

      <main className="px-6 py-8 space-y-4">
        {users.map((user) => (
          <UserRow key={user.id} user={user} />
        ))}

        <UsersPagination page={page} totalPages={3} onPageChange={setPage} />
      </main>
    </div>
  );
}
