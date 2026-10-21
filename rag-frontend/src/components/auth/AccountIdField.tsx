"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";

import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  forgetAccount,
  loadRecentAccounts,
  type RecentAccount,
} from "@/lib/recent-accounts";

const LISTBOX_ID = "account-id-suggestions";

type Props = {
  value: string;
  onChange: (next: string) => void;
  /** Called when a suggestion is chosen, so the form can prefill the email too. */
  onPick?: (account: RecentAccount) => void;
};

/**
 * Account ID input with suggestions drawn from previous successful logins.
 *
 * Hand-rolled rather than built on a Popover primitive, because the project
 * has no popover/command component and because a menu primitive takes focus
 * away from the input -- which would break typing to filter.
 */
export function AccountIdField({ value, onChange, onPick }: Props) {
  const [accounts, setAccounts] = useState<RecentAccount[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  // Read storage after mount, never during render: the server has no
  // localStorage, so rendering from it would mismatch on hydration.
  useEffect(() => setAccounts(loadRecentAccounts()), []);

  const matches = useMemo(() => {
    const query = value.trim().toLowerCase();
    if (!query) return accounts;

    return accounts.filter(
      (account) =>
        account.accountId.includes(query) ||
        (account.organizationName ?? "").toLowerCase().includes(query),
    );
  }, [accounts, value]);

  const isOpen = open && matches.length > 0;

  // Collapse on an outside click. Pointerdown rather than click, so the list
  // is gone before a click elsewhere lands.
  useEffect(() => {
    if (!isOpen) return;

    const handler = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };

    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [isOpen]);

  const pick = (account: RecentAccount) => {
    onChange(account.accountId);
    onPick?.(account);
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (!isOpen) {
      if (event.key === "ArrowDown" && matches.length > 0) {
        event.preventDefault();
        setOpen(true);
        setActiveIndex(0);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      // Take the highlighted suggestion instead of submitting the form.
      event.preventDefault();
      pick(matches[activeIndex]);
    }
  };

  return (
    <Field>
      <FieldLabel htmlFor="account_id">Account ID</FieldLabel>

      <div ref={containerRef} className="relative">
        <Input
          id="account_id"
          name="account_id"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            setOpen(true);
            setActiveIndex(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="11XXXXXXXXXXXXXX"
          inputMode="numeric"
          // Our own list replaces the browser's, which never offers to
          // remember a field it does not recognise anyway.
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={LISTBOX_ID}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${LISTBOX_ID}-${activeIndex}` : undefined
          }
          required
        />

        {isOpen && (
          <ul
            id={LISTBOX_ID}
            role="listbox"
            aria-label="Previously used account IDs"
            // Keep focus in the input so blur does not close the list first.
            onPointerDown={(event) => event.preventDefault()}
            className="bg-popover text-popover-foreground absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-md border shadow-md"
          >
            {matches.map((account, index) => (
              <li
                key={account.accountId}
                id={`${LISTBOX_ID}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm",
                  index === activeIndex && "bg-accent text-accent-foreground",
                )}
              >
                <button
                  type="button"
                  onClick={() => pick(account)}
                  className="min-w-0 flex-1 cursor-pointer text-left"
                >
                  <span className="block truncate font-medium">
                    {account.organizationName ?? account.accountId}
                  </span>
                  <span className="text-muted-foreground block truncate font-mono text-xs">
                    {account.accountId}
                    {account.email ? ` · ${account.email}` : ""}
                  </span>
                </button>

                <button
                  type="button"
                  aria-label={`Forget ${account.organizationName ?? account.accountId}`}
                  onClick={() => setAccounts(forgetAccount(account.accountId))}
                  className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer rounded p-1"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Field>
  );
}
