"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChangePasswordForm } from "@/components/change-password-form";
import { useAuth } from "@/components/auth-provider";

export default function ForceChangePasswordPage() {
  const router = useRouter();
  const { user, mustChangePassword } = useAuth();
  const redirectTo = "/dashboard";

  useEffect(() => {
    if (user?.role === "admin") {
      router.replace("/console/change-password");
    }
  }, [user?.role, router]);

  const forcedTemp = mustChangePassword;

  if (user?.role === "admin") {
    return (
      <div className="flex flex-1 items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-950 text-sm text-gray-500">
        Redirecting to console…
      </div>
    );
  }

  return (
    <ChangePasswordForm
      title="Change your password"
      description={
        forcedTemp
          ? "Enter the temporary password you were given (for example after you used Forgot password on the sign-in page), then choose your new password to finish signing in."
          : "Enter your current password, then choose a new one. You can change your password any time while signed in."
      }
      currentPasswordLabel={forcedTemp ? "Temporary password" : "Current password"}
      currentPasswordPlaceholder={
        forcedTemp
          ? "Temporary password from your administrator"
          : "Enter your current password"
      }
      redirectTo={redirectTo}
      compact={false}
    />
  );
}
