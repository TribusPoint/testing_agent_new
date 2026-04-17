"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import ConsoleShell from "@/components/console-shell";

export default function ConsoleLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "admin") {
      router.replace("/dashboard");
      return;
    }
    setAllowed(true);
  }, [user, router]);

  if (!allowed) {
    return (
      <div className="flex flex-1 min-h-0 items-center justify-center bg-gray-50 dark:bg-gray-950 text-sm text-gray-400">
        Checking access…
      </div>
    );
  }

  return <ConsoleShell>{children}</ConsoleShell>;
}
