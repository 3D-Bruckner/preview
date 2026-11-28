"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Renders the page again every 10 seconds, for 10 minutes at most, while something on it is still being worked out on the server. */
export function RefreshWhilePending() {
  const router = useRouter();
  useEffect(() => {
    let left = 60;
    const timer = setInterval(() => {
      if (--left <= 0) clearInterval(timer);
      router.refresh();
    }, 10_000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
