"use client";

import { useEffect, useState } from "react";
import InviteUserButton from "@/components/users/InviteUserButton";
import UserRow from "@/components/users/UserRow";
import Pagination from "@/components/common/Pagination";
import UserStatsCards from "@/components/users/UserStatsCards";
import { useUsers } from "@/hooks/orgs_user";
import PageLoader from "@/components/common/PageLoader";
import PageError from "@/components/common/PageError";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Search, Users as UsersIcon } from "lucide-react";

const PAGE_SIZE = 10;

export default function UsersPage() {
  const { isMember } = useAuth();

  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  // Debounced: searching is a database query now, so firing one per
  // keystroke would be wasteful.
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isError, isFetching, refetch } = useUsers({
    page,
    limit: PAGE_SIZE,
    search,
  });

  // Only the very first load gets the full-page loader; later fetches keep
  // the previous page on screen via placeholderData.
  if (isLoading && !data) return <PageLoader message="Loading users..." />;

  if (isError)
    return <PageError message="Failed to load users." onRetry={refetch} />;

  const users = data?.users ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="flex flex-col bg-background">
      {/* Header */}
      <div className="border-b bg-card/50 px-4 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 sm:size-12">
              <UsersIcon className="size-5 text-primary sm:size-6" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Users
              </h1>
              <p className="text-sm text-muted-foreground">
                Manage organization members
              </p>
            </div>
          </div>

          {!isMember && (
            <div className="[&>*]:w-full sm:[&>*]:w-auto">
              <InviteUserButton />
            </div>
          )}
        </div>
      </div>

      <main className="space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        {!isMember && <UserStatsCards />}

        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-base font-semibold">
              {search
                ? `${total} ${total === 1 ? "match" : "matches"}`
                : `${total} ${total === 1 ? "member" : "members"}`}
            </p>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name or email..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {users.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed p-12 text-center">
              <p className="text-sm font-medium">
                {search ? "No matching members" : "No members yet"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {search
                  ? "Try a different name or email."
                  : "Invite someone to get started."}
              </p>
            </div>
          ) : (
            <>
              <ul className="flex flex-col gap-3">
                {users.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </ul>

              <Pagination
                page={data?.page ?? page}
                totalPages={data?.total_pages ?? 0}
                total={total}
                limit={data?.limit ?? PAGE_SIZE}
                onPageChange={setPage}
                isFetching={isFetching}
              />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
