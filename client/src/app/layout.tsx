import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import NavLinks from "@/components/nav-links";
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
      <body className="h-full flex flex-col bg-gray-50 dark:bg-gray-950 font-sans">
        <header className="shrink-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-screen-xl mx-auto px-6 h-14 flex items-center gap-8">
            <span className="font-bold text-indigo-600 text-sm tracking-tight">
              Testing Agent
            </span>
            <NavLinks />
          </div>
        </header>
        <main className="flex-1 overflow-hidden max-w-screen-xl mx-auto w-full">
          {children}
        </main>
      </body>
    </html>
  );
}
