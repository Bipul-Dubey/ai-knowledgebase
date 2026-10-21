"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { PATHS } from "@/constants/paths";
import { useSnackbar } from "notistack";
import { FormEvent } from "react";
import { useSignup } from "@/hooks/auth";
import axios from "axios";
import { PasswordInput } from "@/components/ui/password-input";
import { useRouter } from "next/navigation";

interface ApiErrorResponse {
  message?: string;
}

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<"form">) {
  const { mutate, isPending } = useSignup();
  const { enqueueSnackbar } = useSnackbar();
  const router = useRouter();

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const formData = new FormData(e.currentTarget);

    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirm-password") as string;

    if (password !== confirmPassword) {
      enqueueSnackbar("Passwords do not match", { variant: "error" });
      return;
    }

    mutate(
      {
        organization_name: formData.get("organization_name") as string,
        owner_name: formData.get("name") as string,
        email: formData.get("email") as string,
        password,
      },
      {
        onSuccess: () => {
          enqueueSnackbar("Account created successfully 🎉", {
            variant: "success",
          });

          router.replace(PATHS.pl.LOGIN);
        },

        onError: (error: unknown) => {
          let message = "Signup failed";

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
          <h1 className="text-2xl font-bold">Create your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Fill in the form below to create your account
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="organization_name">Organization Name</FieldLabel>
          <Input
            id="organization_name"
            name="organization_name"
            type="text"
            placeholder="NewITEra Corp"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="name">Full Name</FieldLabel>
          <Input
            id="name"
            name="name"
            type="text"
            placeholder="Johnson"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            required
          />
          <FieldDescription>
            We&apos;ll use this to contact you. We will not share your email
            with anyone else.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Password</FieldLabel>

          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
          />

          <FieldDescription>
            Must be at least 8 characters long.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="confirm-password">Confirm Password</FieldLabel>

          <PasswordInput
            id="confirm-password"
            name="confirm-password"
            autoComplete="new-password"
            required
          />

          <FieldDescription>Please confirm your password.</FieldDescription>
        </Field>

        <Field>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Creating Account..." : "Create Account"}
          </Button>
        </Field>

        <FieldSeparator />

        <Field>
          <FieldDescription className="px-6 text-center">
            Already have an account? <Link href={PATHS.pl.LOGIN}>Sign in</Link>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
