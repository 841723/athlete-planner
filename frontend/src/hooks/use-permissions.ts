import { useAuth } from "@/components/auth/auth-context";

export function usePermissions() {
  const { tenants, activeTenantId } = useAuth();
  const active = tenants.find((t) => t.id === activeTenantId);
  const role = active?.role ?? null;
  return {
    role,
    isOwner: active?.isOwner ?? false,
    canEdit: role !== null && role !== "visitor",
    canSync: role !== null && role !== "visitor",
    canManageUsers: role === "admin" || role === "athlete",
    canGeneratePlan: role !== null && role !== "visitor",
  };
}
