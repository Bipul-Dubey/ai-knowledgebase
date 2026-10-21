/**
 * Account IDs this browser has signed in with, so the login form can suggest
 * them -- browsers never remember this field. Written only after a successful
 * login; every read tolerates storage being absent, blocked or corrupt.
 */

export type RecentAccount = {
  accountId: string;
  organizationName?: string;
  email?: string;
  lastUsedAt: number;
};

const STORAGE_KEY = "recent_accounts";
const MAX_ENTRIES = 5;

function isRecentAccount(value: unknown): value is RecentAccount {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.accountId === "string" &&
    candidate.accountId.length > 0 &&
    typeof candidate.lastUsedAt === "number"
  );
}

/** Most recent first. [] if storage is unavailable or corrupt. */
export function loadRecentAccounts(): RecentAccount[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isRecentAccount)
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .slice(0, MAX_ENTRIES);
  } catch {
    // Private window, blocked site data, or a malformed value.
    return [];
  }
}

function persist(accounts: RecentAccount[]): RecentAccount[] {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // Non-fatal: suggestions just will not survive the session.
  }
  return accounts;
}

/** Record a successful login. Upserts on accountId, no duplicates. */
export function rememberAccount(
  entry: Omit<RecentAccount, "lastUsedAt">,
): RecentAccount[] {
  if (typeof window === "undefined" || !entry.accountId) return [];

  const others = loadRecentAccounts().filter(
    (a) => a.accountId !== entry.accountId,
  );

  return persist(
    [{ ...entry, lastUsedAt: Date.now() }, ...others].slice(0, MAX_ENTRIES),
  );
}

/** Drop one entry, including its stored email. */
export function forgetAccount(accountId: string): RecentAccount[] {
  if (typeof window === "undefined") return [];
  return persist(
    loadRecentAccounts().filter((a) => a.accountId !== accountId),
  );
}
