import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import SidebarNav from "@/components/sidebar-nav";
import { COLOR_MODE_STORAGE_KEY, ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

/** Must stay in sync with `applyColorModeToDocument` / `resolveColorMode` in theme-provider.tsx */
const THEME_INIT_SCRIPT = `(function(){try{var k=${JSON.stringify(COLOR_MODE_STORAGE_KEY)};var v=localStorage.getItem(k)||"system";var dark=v==="dark"||(v==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);}catch(e){}})();`;

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Testing Agent",
  description: "Salesforce AgentForce Testing Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950 font-sans text-gray-900 dark:text-gray-100">
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
        <ThemeProvider>
          <div className="flex flex-1 min-h-0">
            <SidebarNav />
            <main className="flex-1 min-h-0 flex flex-col overflow-hidden w-full min-w-0">{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
