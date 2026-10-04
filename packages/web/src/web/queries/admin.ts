import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** Owner/Admin: all accounts of this NORVI AI instance. */
export function useAdminUsers(enabled: boolean) {
  return useQuery(orpc.admin.users.queryOptions({ enabled, retry: false }));
}

/** Owner/Admin: real usage numbers from the database. */
export function useAdminStats(enabled: boolean) {
  return useQuery(orpc.admin.stats.queryOptions({ enabled, retry: false }));
}

/** Owner/Admin: runtime health of the local NORVI server. */
export function useAdminSystem(enabled: boolean) {
  return useQuery(
    orpc.admin.system.queryOptions({
      enabled,
      retry: false,
      refetchInterval: 15_000,
    }),
  );
}

function useInvalidateAdmin() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.admin.key() });
}

export function useSetRole() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.setRole.mutationOptions({ onSuccess: invalidate }));
}

export function useSetActive() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.setActive.mutationOptions({ onSuccess: invalidate }));
}

export function useSetPremium() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.setPremium.mutationOptions({ onSuccess: invalidate }));
}

export function useSetChokeMode() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.setChokeMode.mutationOptions({ onSuccess: invalidate }));
}

export function useSetRegistration() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.setRegistration.mutationOptions({ onSuccess: invalidate }));
}
