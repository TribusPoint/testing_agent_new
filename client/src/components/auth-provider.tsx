"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { StoredUser } from "@/lib/api";
import {
  getStoredToken,
  getStoredUser,
  getStoredKey,
  setStoredToken,
  setStoredUser,
  clearAllAuth,
} from "@/lib/api";

interface AuthContextValue {
  user: StoredUser | null;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  handleLogin: (token: string, user: StoredUser) => void;
  handleLogout: () => void;
  clearMustChangePassword: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthenticated: false,
  mustChangePassword: false,
  handleLogin: () => {},
  handleLogout: () => {},
  clearMustChangePassword: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

const PUBLIC_PATHS = ["/login"];
const FORCE_PW_PATH = "/change-password";

function getInitialUser(): StoredUser | null {
  if (typeof window === "undefined") return null;
  return getStoredToken() ? getStoredUser() : null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<StoredUser | null>(getInitialUser);
  const [mustChangePassword, setMustChangePassword] = useState(false);

  const isAuthenticated = !!user;

  const handleLogin = useCallback((token: string, u: StoredUser) => {
    setStoredToken(token);
    setStoredUser(u);
    setUser(u);
    if ((u as StoredUser & { must_change_password?: boolean }).must_change_password) {
      setMustChangePassword(true);
    }
  }, []);

  const handleLogout = useCallback(() => {
    clearAllAuth();
    setUser(null);
    setMustChangePassword(false);
    router.push("/login");
  }, [router]);

  const clearMustChangePassword = useCallback(() => {
    setMustChangePassword(false);
  }, []);

  useEffect(() => {
    if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname) && pathname !== FORCE_PW_PATH) {
      const hasApiKeySession = typeof window !== "undefined" && !!getStoredKey();
      if (!hasApiKeySession) {
        router.replace("/login");
      }
    }
    if (isAuthenticated && mustChangePassword && pathname !== FORCE_PW_PATH && pathname !== "/login") {
      router.replace(FORCE_PW_PATH);
    }
  }, [isAuthenticated, mustChangePassword, pathname, router]);

  const value = useMemo(
    () => ({ user, isAuthenticated, mustChangePassword, handleLogin, handleLogout, clearMustChangePassword }),
    [user, isAuthenticated, mustChangePassword, handleLogin, handleLogout, clearMustChangePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
