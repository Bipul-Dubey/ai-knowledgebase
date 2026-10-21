"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { PATHS } from "@/constants/paths";
import { FormEvent, useState } from "react";
import { useForgotPassword } from "@/hooks/auth";
import { useSnackbar } from "notistack";
import axios from "axios";
import { AccountIdField } from "@/components/auth/AccountIdField";
import { MailCheck } from "lucide-react";

interface ApiErrorResponse {
  message?: string;
}

export function ForgotPasswordForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { mutate, isPending } = useForgotPassword();
  const { enqueueSnackbar } = useSnackbar();

  const [accountId, setAccountId] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    mutate(
      { account_id: accountId.trim(), email: email.trim() },
      {
        onSuccess: () => {
          // Deliberately the same outcome whether or not the address is
          // registered, matching the backend.
          setSent(true);
        },
        onError: (error: unknown) => {
          let message = "Could not send the reset link";

          if (axios.isAxiosError<ApiErrorResponse>(error)) {
            message = error.response?.data?.message ?? message;
          }

          enqueueSnackbar(message, { variant: "error" });
        },
      },
    );
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-primary/10">
          <MailCheck className="size-6 text-primary" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-muted-foreground text-sm text-balance">
            If an account exists for <span className="font-medium">{email}</span>
            , we&apos;ve sent a link to reset your password. It expires in one
            hour.
          </p>
        </div>

        <FieldDescription className="text-center">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <button
            type="button"
            onClick={() => setSent(false)}
            className="underline underline-offset-4"
          >
            try again
          </button>
          .
        </FieldDescription>

        <Link
          href={PATHS.pl.LOGIN}
          className="text-sm underline underline-offset-4"
        >
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Forgot your password?</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your account ID and email, and we&apos;ll send you a reset
            link
          </p>
        </div>

        <AccountIdField
          value={accountId}
          onChange={setAccountId}
          onPick={(account) => {
            setAccountId(account.accountId);
            if (account.email && !email.trim()) setEmail(account.email);
          }}
        />

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="m@example.com"
            autoComplete="username"
            required
          />
        </Field>

        <Field>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Sending..." : "Send reset link"}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          Remembered it?{" "}
          <Link href={PATHS.pl.LOGIN} className="underline underline-offset-4">
            Back to login
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
