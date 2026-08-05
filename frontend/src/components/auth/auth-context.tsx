import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchMe, googleLogin, logout, switchTenant, setApiTenant } from "@/services/api";
import type { User, TenantInfo } from "@/types/auth";

type AuthStatus = "loading" | "authed" | "anonymous";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  tenants: TenantInfo[];
  activeTenantId: string | null;
  login: (credential: string) => Promise<void>;
  logout: () => Promise<void>;
  switchTenant: (tenantId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [tenants, setTenants] = useState<TenantInfo[]>([]);
  const [activeTenantId, setActiveTenantId] = useState<string | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      const me = await fetchMe();
      setUser(me.user);
      setTenants(me.tenants);
      setActiveTenantId(me.activeTenantId);
      setApiTenant(me.activeTenantId);
      setStatus("authed");
    } catch {
      setUser(null);
      setTenants([]);
      setActiveTenantId(null);
      setApiTenant(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    const handler = () => {
      setUser(null);
      setTenants([]);
      setActiveTenantId(null);
      setApiTenant(null);
      setStatus("anonymous");
    };
    window.addEventListener("auth:unauthorized", handler);
    return () => window.removeEventListener("auth:unauthorized", handler);
  }, []);

  const login = useCallback(
    async (credential: string) => {
      await googleLogin(credential);
      await refreshMe();
    },
    [refreshMe]
  );

  const handleLogout = useCallback(async () => {
    try {
      await logout();
    } catch {
      /* ignorar */
    }
    qc.clear();
    setUser(null);
    setTenants([]);
    setActiveTenantId(null);
    setApiTenant(null);
    setStatus("anonymous");
  }, [qc]);

  const handleSwitchTenant = useCallback(
    async (tenantId: string) => {
      await switchTenant(tenantId);
      setApiTenant(tenantId);
      setActiveTenantId(tenantId);
      qc.invalidateQueries();
    },
    [qc]
  );

  return (
    <AuthContext.Provider
      value={{ status, user, tenants, activeTenantId, login, logout: handleLogout, switchTenant: handleSwitchTenant, refresh: refreshMe }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
