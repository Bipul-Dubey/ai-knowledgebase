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
import { FormEvent } from "react";
import { useLogin } from "@/hooks/auth";
import { useSnackbar } from "notistack";
import axios from "axios";
import { useRouter } from "next/navigation";

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

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    mutate(
      {
        account_id: formData.get("account_id") as string,
        email: formData.get("email") as string,
        password: formData.get("password") as string,
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

        {/* Account ID */}
        <Field>
          <FieldLabel htmlFor="account_id">Account ID</FieldLabel>
          <Input
            id="account_id"
            name="account_id"
            placeholder="11XXXXXXXXXXXXXX"
            required
          />
        </Field>

        {/* Email */}
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            required
          />
        </Field>

        {/* Password */}
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Link
              href="#"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </Link>
          </div>
          <Input id="password" name="password" type="password" required />
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
