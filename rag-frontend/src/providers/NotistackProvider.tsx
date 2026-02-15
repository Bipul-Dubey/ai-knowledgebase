"use client";

import { SnackbarProvider } from "notistack";
import { ReactNode } from "react";

export default function NotistackProvider({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <SnackbarProvider
      maxSnack={3}
      autoHideDuration={3000}
      hideIconVariant={false}
      anchorOrigin={{
        vertical: "top",
        horizontal: "right",
      }}
    >
      {children}
    </SnackbarProvider>
  );
}
