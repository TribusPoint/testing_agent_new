"use client";

import { ChangePasswordForm } from "@/components/change-password-form";
import { useAuth } from "@/components/auth-provider";

export default function ConsoleChangePasswordPage() {
  const { user } = useAuth();
  const redirectTo = user?.role === "admin" ? "/console" : "/dashboard";

  return (
    <div className="flex-1 overflow-y-auto min-h-0 p-6 sm:p-10">
      <div className="max-w-lg mx-auto">
        <ChangePasswordForm
          title="Change your password"
          description="Enter your current password, the admin secret code (same as for approving member password resets), and your new password. When you are done, you will return to the console overview."
          currentPasswordLabel="Current password"
          redirectTo={redirectTo}
          showLogout={false}
          compact
          backHref="/console"
          backLabel="Overview"
          requireAdminSecret
        />
      </div>
    </div>
  );
}
