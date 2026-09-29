"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The local app has no landing page: go straight to the dashboard
export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/");
  }, [router]);
  return null;
}
