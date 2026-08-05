import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMembers,
  addMember,
  updateMemberRole,
  removeMember,
} from "@/services/api";
import type { Member, TenantRole } from "@/types/auth";

export function useMembers(tenantId: string | null) {
  return useQuery<Member[]>({
    queryKey: ["members", tenantId],
    queryFn: () => fetchMembers(tenantId!),
    enabled: Boolean(tenantId),
  });
}

function useInvalidateMembers(tenantId: string | null) {
  const qc = useQueryClient();
  return () => {
    if (tenantId) qc.invalidateQueries({ queryKey: ["members", tenantId] });
  };
}

export function useAddMember(tenantId: string | null) {
  const invalidate = useInvalidateMembers(tenantId);
  return useMutation({
    mutationFn: (payload: { email: string; role: TenantRole }) => addMember(tenantId!, payload),
    onSuccess: invalidate,
  });
}

export function useUpdateMemberRole(tenantId: string | null) {
  const invalidate = useInvalidateMembers(tenantId);
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: TenantRole }) =>
      updateMemberRole(tenantId!, userId, role),
    onSuccess: invalidate,
  });
}

export function useRemoveMember(tenantId: string | null) {
  const invalidate = useInvalidateMembers(tenantId);
  return useMutation({
    mutationFn: (userId: string) => removeMember(tenantId!, userId),
    onSuccess: invalidate,
  });
}
