"use client";

import { useState, useMemo } from "react";
import InviteUserButton from "@/components/users/InviteUserButton";
import UserRow from "@/components/users/UserRow";
import UsersPagination from "@/components/users/UsersPagination";
import { useUsers } from "@/hooks/orgs_user";
import PageLoader from "@/components/common/PageLoader";
import PageError from "@/components/common/PageError";
import { useAuth } from "@/hooks/useAuth";
import { IUser } from "@/types/apis";

const sortUsers = (users: IUser[], currentUserId: string) => {
  const getPriority = (user: IUser) => {
    if (user.role === "owner") return 1;
    if (user.id === currentUserId) return 2;
    return 3;
  };

  return [...users].sort((a, b) => {
    const priorityDiff = getPriority(a) - getPriority(b);
    if (priorityDiff !== 0) return priorityDiff;

    return a.name.localeCompare(b.name);
  });
};

export default function UsersPage() {
  const { data: users = [], isLoading, isError, refetch } = useUsers();
  const [page, setPage] = useState(1);
  const { isMember, user } = useAuth();

  // ✅ Memoized sorted users
  const currentUserId = user?.id;

  const sortedUsers = useMemo(() => {
    if (!currentUserId) return users;
    return sortUsers(users, currentUserId);
  }, [users, currentUserId]);

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

        {!isMember && <InviteUserButton />}
      </div>

      <main className="px-6 py-8 space-y-4">
        {sortedUsers.map((u) => (
          <UserRow key={u.id} user={u} />
        ))}

        <UsersPagination page={page} totalPages={3} onPageChange={setPage} />
      </main>
    </div>
  );
}
