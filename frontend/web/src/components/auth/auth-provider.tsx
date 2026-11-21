"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SessionUser = {
    id: number;
    email: string;
    name: string | null;
    role: "super_admin" | "admin" | "user";
    status: string;
    mfa_enabled: boolean;
};

type AuthContextValue = {
    user: SessionUser | null;
    loading: boolean;
    refresh: () => Promise<void>;
    logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
    user: null,
    loading: true,
    refresh: async () => {},
    logout: async () => {},
});

const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
const CHECK_INTERVAL_MS = 30 * 1000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<SessionUser | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const lastActivityRef = useRef<number>(Date.now());

  const refresh = useCallback(async () => {
        try {
                const res = await fetch("/api/auth/session", { cache: "no-store" });
                const data = await res.json();
                setUser(data.user ?? null);
        } catch {
                setUser(null);
        } finally {
                setLoading(false);
        }
  }, []);

  const logout = useCallback(async () => {
        try {
                await fetch("/api/auth/logout", { method: "POST" });
        } catch {
                // ignore
        }
        setUser(null);
        router.push("/login");
  }, [router]);

  useEffect(() => {
        refresh();
  }, [refresh]);

  useEffect(() => {
        const markActivity = () => {
                lastActivityRef.current = Date.now();
        };
        window.addEventListener("mousemove", markActivity);
        window.addEventListener("keydown", markActivity);
        window.addEventListener("click", markActivity);

                const interval = setInterval(() => {
                        if (user && Date.now() - lastActivityRef.current > INACTIVITY_LIMIT_MS) {
                                  logout();
                        }
                }, CHECK_INTERVAL_MS);

                return () => {
                        window.removeEventListener("mousemove", markActivity);
                        window.removeEventListener("keydown", markActivity);
                        window.removeEventListener("click", markActivity);
                        clearInterval(interval);
                };
  }, [user, logout]);

  return (
        <AuthContext.Provider value={{ user, loading, refresh, logout }}>
          {children}
        </AuthContext.Provider>
  );
}

export function useAuth() {
    return useContext(AuthContext);
}
