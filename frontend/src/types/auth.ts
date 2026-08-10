export type TenantRole = "athlete" | "admin" | "visitor";

export interface User {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  isSuperAdmin?: boolean;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  role: TenantRole;
  isOwner: boolean;
}

export interface MeResponse {
  user: User;
  tenants: TenantInfo[];
  activeTenantId: string | null;
}

export interface Member {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  role: TenantRole;
  isOwner: boolean;
  createdAt: string;
}
