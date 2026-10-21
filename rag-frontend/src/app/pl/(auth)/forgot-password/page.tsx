import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";
import Image from "next/image";

export default function ForgotPasswordPage() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="relative hidden lg:flex items-center justify-center bg-muted">
        <Image
          src="/images/login.png"
          alt="Forgot password"
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
            <ForgotPasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
