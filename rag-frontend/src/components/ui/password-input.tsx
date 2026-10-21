"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Eye, EyeOff } from "lucide-react";

/**
 * Password field with a show/hide toggle.
 *
 * `type` is owned by this component, so it is omitted from the props: the
 * whole point is that the caller cannot pin it to "password".
 */
function PasswordInput({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  const [visible, setVisible] = React.useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        // Room for the toggle, so a long value never runs under the icon.
        className={cn("pr-10", className)}
      />

      <button
        type="button"
        onClick={() => setVisible((prev) => !prev)}
        // Focusable on purpose: a control that only works with a mouse is
        // not reachable for keyboard and screen-reader users.
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export { PasswordInput };
