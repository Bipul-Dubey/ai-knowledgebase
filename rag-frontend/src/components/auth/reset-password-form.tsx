"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import Link from "next/link";
import { PATHS } from "@/constants/paths";
import { FormEvent, useState } from "react";
import { useResetPasswordByEmail } from "@/hooks/auth";
import { useSnackbar } from "notistack";
import axios from "axios";
import { useRouter } from "next/navigation";

interface ApiErrorResponse {
  message?: string;
}

const MIN_PASSWORD_LENGTH = 8;

export function ResetPasswordForm({
  token,
  className,
  ...props
}: React.ComponentProps<"form"> & { token: string }) {
  const { mutate, isPending } = useResetPasswordByEmail();
  const { enqueueSnackbar } = useSnackbar();
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    // Uncontrolled so password managers offer to save the new password.
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm_password") as string;

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    mutate(
      { token, new_password: password },
      {
        onSuccess: (response) => {
          enqueueSnackbar(response.message ?? "Password updated", {
            variant: "success",
          });

          router.replace(PATHS.pl.LOGIN);
        },
        onError: (err: unknown) => {
          let message = "Could not reset your password";

          if (axios.isAxiosError<ApiErrorResponse>(err)) {
            message = err.response?.data?.message ?? message;
          }

          setError(message);
          enqueueSnackbar(message, { variant: "error" });
        },
      },
    );
  };

  return (
    <form
      className={cn("flex flex-col gap-6", className)}
      onSubmit={handleSubmit}
      {...props}
    >
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Set a new password</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Choose a password you haven&apos;t used before
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="password">New password</FieldLabel>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
          <FieldDescription>
            At least {MIN_PASSWORD_LENGTH} characters.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm_password">Confirm password</FieldLabel>
          <PasswordInput
            id="confirm_password"
            name="confirm_password"
            autoComplete="new-password"
            minLength={MIN_PASSWORD_LENGTH}
            required
          />
        </Field>

        {error && (
          <p className="text-destructive text-sm text-center">{error}</p>
        )}

        <Field>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Updating..." : "Update password"}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          <Link href={PATHS.pl.LOGIN} className="underline underline-offset-4">
            Back to login
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
