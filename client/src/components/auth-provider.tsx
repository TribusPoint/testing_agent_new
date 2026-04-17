"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { StoredUser } from "@/lib/api";
import {
  getStoredToken,
  getStoredUser,
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

function readStoredAuth(): { user: StoredUser | null; mustChangePassword: boolean } {
  const u = getInitialUser();
  if (!u) return { user: null, mustChangePassword: false };
  return { user: u, mustChangePassword: Boolean(u.must_change_password) };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const initial = readStoredAuth();
  const [user, setUser] = useState<StoredUser | null>(initial.user);
  const [mustChangePassword, setMustChangePassword] = useState(initial.mustChangePassword);

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
    setUser((prev) => {
      if (!prev) return prev;
      const { must_change_password: _m, ...rest } = prev;
      const next = { ...rest } as StoredUser;
      setStoredUser(next);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticated && !PUBLIC_PATHS.includes(pathname) && pathname !== FORCE_PW_PATH) {
      router.replace("/login");
    }
    if (isAuthenticated && mustChangePassword && pathname !== "/change-password" && pathname !== "/console/change-password" && pathname !== "/login") {
      const dest = user?.role === "admin" ? "/console/change-password" : FORCE_PW_PATH;
      router.replace(dest);
    }
  }, [isAuthenticated, mustChangePassword, pathname, router, user?.role]);

  const value = useMemo(
    () => ({ user, isAuthenticated, mustChangePassword, handleLogin, handleLogout, clearMustChangePassword }),
    [user, isAuthenticated, mustChangePassword, handleLogin, handleLogout, clearMustChangePassword],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
