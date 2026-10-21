"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { useAcceptInvite } from "@/hooks/orgs_user";
import { PATHS } from "@/constants/paths";
import PageLoader from "@/components/common/PageLoader";

interface FormState {
  name: string;
  email: string;
  password: string;
}

interface FormErrors {
  name?: string;
  email?: string;
  password?: string;
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <AcceptInvite />
    </Suspense>
  );
}

function AcceptInvite() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const token = searchParams.get("token") ?? "";
  const account_id = searchParams.get("account_id") ?? "";

  const { mutate, isPending, isSuccess, isError } = useAcceptInvite();

  const [form, setForm] = useState<FormState>({
    name: "",
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const newErrors: FormErrors = {};

    if (!form.name.trim()) {
      newErrors.name = "Name is required";
    }

    if (!form.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Invalid email address";
    }

    const passwordRegex =
      /^(?=.*[A-Za-z])(?=.*\d)(?=.*[@$!%*#?&])[A-Za-z\d@$!%*#?&]{8,}$/;

    if (!form.password) {
      newErrors.password = "Password is required";
    } else if (!passwordRegex.test(form.password)) {
      newErrors.password =
        "Password must be 8+ chars, include letter, number & symbol";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    mutate(
      {
        token,
        account_id,
        name: form.name,
        email: form.email,
        password: form.password,
      },
      {
        onSuccess: () => {
          setTimeout(() => {
            router.push(PATHS.pl.LOGIN);
          }, 2000);
        },
      },
    );
  };

  if (!token || !account_id) {
    return (
      <div className="flex items-center justify-center h-screen">
        Invalid invite link
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-md shadow-lg">
        <CardContent className="p-6 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-semibold">Accept Invitation</h1>
            <p className="text-sm text-muted-foreground">
              Complete your account setup
            </p>
          </div>

          <div className="space-y-4">
            {/* Name */}
            <div>
              <Input
                placeholder="Full Name"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    name: e.target.value,
                  }))
                }
              />
              {errors.name && (
                <p className="text-xs text-destructive mt-1">{errors.name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
              />
              {errors.email && (
                <p className="text-xs text-destructive mt-1">{errors.email}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <PasswordInput
                placeholder="Password"
                autoComplete="new-password"
                value={form.password}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
              />

              {errors.password && (
                <p className="text-xs text-destructive mt-1">
                  {errors.password}
                </p>
              )}
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={isPending}
            >
              {isPending ? "Creating Account..." : "Accept & Continue"}
            </Button>

            {isSuccess && (
              <p className="text-sm text-emerald-600 text-center">
                Account created successfully! Redirecting...
              </p>
            )}

            {isError && (
              <p className="text-sm text-destructive text-center">
                Failed to accept invite. Please try again.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
