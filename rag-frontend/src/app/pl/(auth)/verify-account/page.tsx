"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useVerifyAccount } from "@/hooks/auth";
import { useSnackbar } from "notistack";
import axios from "axios";
import { PATHS } from "@/constants/paths";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import PageLoader from "@/components/common/PageLoader";

interface ApiErrorResponse {
  message?: string;
}

export default function Page() {
  return (
    <Suspense fallback={<PageLoader />}>
      <VerifyAccount />
    </Suspense>
  );
}

const VerifyAccount = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { enqueueSnackbar } = useSnackbar();

  const token = searchParams.get("token");
  const { mutate, isPending } = useVerifyAccount();

  useEffect(() => {
    if (!token) {
      enqueueSnackbar("Invalid or missing verification token", {
        variant: "error",
      });
      router.replace(PATHS.pl.LOGIN);
      return;
    }

    mutate(
      { token },
      {
        onSuccess: (response) => {
          enqueueSnackbar(response.message, {
            variant: "success",
          });

          setTimeout(() => {
            router.replace(PATHS.pl.LOGIN);
          }, 2000);
        },
        onError: (error: unknown) => {
          let message = "Account verification failed";

          if (axios.isAxiosError<ApiErrorResponse>(error)) {
            message = error.response?.data?.message ?? message;
          }

          enqueueSnackbar(message, {
            variant: "error",
            autoHideDuration: 5000,
          });

          setTimeout(() => {
            router.replace(PATHS.pl.LOGIN);
          }, 1000);
        },
      },
    );
  }, [token, mutate, enqueueSnackbar, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md rounded-xl border bg-background p-8 shadow-lg">
        <div className="flex flex-col items-center gap-6 text-center">
          {/* ✅ Logo (kept exactly as requested) */}
          <div className="relative size-24 overflow-hidden rounded-md">
            <Image
              src="/images/logos.png"
              alt="Logo"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Heading */}
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Verifying your account</h1>
            <p className="text-sm text-muted-foreground">
              {isPending
                ? "Please wait while we securely verify your account."
                : "Verification complete. Redirecting you to login…"}
            </p>
          </div>

          {/* Loader */}
          {isPending && (
            <div className="flex items-center gap-2 text-primary">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-sm font-medium">Verifying</span>
            </div>
          )}

          {/* Footer hint */}
          <p className="text-xs text-muted-foreground">
            This may take a few seconds. Please do not refresh the page.
          </p>
        </div>
      </div>
    </div>
  );
};
