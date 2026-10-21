"use client";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import PageLoader from "@/components/common/PageLoader";
import { PATHS } from "@/constants/paths";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <ResetPassword />
    </Suspense>
  );
}

const ResetPassword = () => {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden lg:flex items-center justify-center bg-muted">
        <Image
          src="/images/login.png"
          alt="Reset password"
          fill
          priority
          className="absolute inset-0 h-full w-full object-left dark:brightness-[0.2] dark:grayscale"
        />
      </div>
      <div className="flex min-h-screen flex-col p-6 md:p-10">
        <div className="flex flex-1 flex-col items-center justify-center gap-6">
          <div className="relative size-24 overflow-hidden rounded-md">
            <Image
              src="/images/logos.png"
              alt="Logo"
              fill
              className="object-contain"
              priority
            />
          </div>

          <div className="w-full max-w-xs">
            {token ? (
              <ResetPasswordForm token={token} />
            ) : (
              <div className="flex flex-col items-center gap-4 text-center">
                <h1 className="text-2xl font-bold">Link not valid</h1>
                <p className="text-muted-foreground text-sm text-balance">
                  This reset link is missing its token. Request a new one and
                  open the most recent email.
                </p>
                <Link
                  href={PATHS.pl.FORGOT_PASSWORD}
                  className="text-sm underline underline-offset-4"
                >
                  Request a new link
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
