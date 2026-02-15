"use client";
import { useRouter } from "next/navigation";
import React, { useLayoutEffect } from "react";

const RootPage = () => {
  const router = useRouter();

  useLayoutEffect(() => {
    router.push("/pl");
  }, [router]);
  return <div>RootPage</div>;
};

export default RootPage;
