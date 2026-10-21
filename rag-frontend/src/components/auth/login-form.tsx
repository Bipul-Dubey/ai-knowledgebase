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
import { PasswordInput } from "@/components/ui/password-input";
import Link from "next/link";
import { PATHS } from "@/constants/paths";
import { FormEvent, useState } from "react";
import { useLogin } from "@/hooks/auth";
import { useSnackbar } from "notistack";
import axios from "axios";
import { useRouter } from "next/navigation";
import { AccountIdField } from "@/components/auth/AccountIdField";
import { rememberAccount } from "@/lib/recent-accounts";

interface ApiErrorResponse {
  message?: string;
}

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { mutate, isPending } = useLogin();
  const { enqueueSnackbar } = useSnackbar();
  const router = useRouter();

  const [accountId, setAccountId] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Password stays uncontrolled so password managers behave normally.
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;

    mutate(
      {
        account_id: accountId.trim(),
        email: email.trim(),
        password,
      },
      {
        onSuccess: (response) => {
          const user = response.data;

          if (!user) {
            enqueueSnackbar("Something went really wrong!", {
              variant: "error",
            });
          } else {
            // OPTIONAL: store token
            localStorage.setItem("access_token", user.access_token);

            // Only on success, so typos never get suggested back.
            rememberAccount({
              accountId: accountId.trim(),
              organizationName: user.organization_name,
              email: user.email || email.trim(),
            });

            enqueueSnackbar(response.message, {
              variant: "success",
            });

            router.replace(PATHS.pl.DASHBOARD(user.organization_id));
          }
        },
        onError: (error: unknown) => {
          let message = "Login failed";

          if (axios.isAxiosError<ApiErrorResponse>(error)) {
            message = error.response?.data?.message ?? message;
          }

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
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your details below to login
          </p>
        </div>

        {/* Account ID, with suggestions from previous successful logins */}
        <AccountIdField
          value={accountId}
          onChange={setAccountId}
          onPick={(account) => {
            setAccountId(account.accountId);
            // Blank email only -- never overwrite what is being typed.
            if (account.email && !email.trim()) setEmail(account.email);
          }}
        />

        {/* Email */}
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="m@example.com"
            // Pairs with current-password: marks this a sign-in form.
            autoComplete="username"
            required
          />
        </Field>

        {/* Password */}
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              href={PATHS.pl.FORGOT_PASSWORD}
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
          />
        </Field>

        <Field>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Logging in..." : "Login"}
          </Button>
        </Field>

        <FieldDescription className="text-center">
          Don&apos;t have an account?{" "}
          <Link
            href={PATHS.pl.REGISTER}
            className="underline underline-offset-4"
          >
            Sign up
          </Link>
        </FieldDescription>
      </FieldGroup>
    </form>
  );
}
