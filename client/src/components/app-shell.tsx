"use client";

import { usePathname } from "next/navigation";
import SidebarNav from "@/components/sidebar-nav";

const NO_SIDEBAR_PATHS = ["/login"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = NO_SIDEBAR_PATHS.includes(pathname);

  if (hideSidebar) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-1 min-h-0 w-full">
      <SidebarNav />
      <main className="flex-1 min-h-0 flex flex-col overflow-hidden w-full min-w-0 bg-gray-50 dark:bg-gray-950">
        {children}
      </main>
    </div>
  );
}
