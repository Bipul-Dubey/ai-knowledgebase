/**
 * Account IDs this browser has signed in with, so the login form can suggest
 * them the way a password manager suggests an email.
 *
 * A 16-digit account ID is the one credential nobody can remember, and unlike
 * email or password it is not something browsers offer to store, so the app
 * has to do it.
 *
 * Scope and lifetime: this is per-browser convenience data, written only after
 * a *successful* login (so typos never get remembered) and removable per entry
 * from the form. It is deliberately not treated as durable state -- every read
 * tolerates it being absent, blocked or corrupt, because localStorage throws
 * in private windows and when site data is disabled.
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

/** Most recently used first. Returns [] if storage is unavailable or corrupt. */
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
    // Private window, blocked site data, or someone else's malformed value.
    return [];
  }
}

function persist(accounts: RecentAccount[]): RecentAccount[] {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts));
  } catch {
    // Non-fatal: suggestions simply will not survive this session.
  }
  return accounts;
}

/**
 * Record a successful login. Upserts on accountId so the same account moves to
 * the top rather than accumulating duplicates.
 */
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

/** Drop one entry, including whatever email was stored alongside it. */
export function forgetAccount(accountId: string): RecentAccount[] {
  if (typeof window === "undefined") return [];
  return persist(
    loadRecentAccounts().filter((a) => a.accountId !== accountId),
  );
}
