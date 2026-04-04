import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import SidebarNav from "@/components/sidebar-nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Testing Agent",
  description: "Salesforce AgentForce Testing Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="h-full flex flex-col overflow-hidden bg-gray-50 dark:bg-gray-950 font-sans">
        <div className="flex flex-1 min-h-0">
          <SidebarNav />
          <main className="flex-1 min-h-0 flex flex-col overflow-hidden w-full min-w-0">{children}</main>
        </div>
      </body>
    </html>
  );
}
