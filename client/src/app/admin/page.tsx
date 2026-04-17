"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy URL — admin tools live under `/console`. */
export default function AdminRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/console/access");
  }, [router]);
  return (
    <div className="flex flex-1 min-h-0 items-center justify-center text-sm text-gray-400 bg-gray-50 dark:bg-gray-950">
      Redirecting…
    </div>
  );
}
