export function tenantPath(tenantId: string | null, path = "/") {
  if (!tenantId) return path === "/" ? "/" : path;
  return `/${tenantId}${path === "/" ? "" : path}`;
}

export function replaceTenantInPath(pathname: string, tenantId: string) {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return `/${tenantId}`;
  segments[0] = tenantId;
  return `/${segments.join("/")}`;
}
