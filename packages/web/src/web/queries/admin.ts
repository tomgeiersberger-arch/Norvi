import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** Owner-only: all accounts of this NORVI AI instance. */
export function useAdminUsers(enabled: boolean) {
  return useQuery(orpc.admin.users.queryOptions({ enabled, retry: false }));
}

/** Owner-only: real usage numbers from the database. */
export function useAdminStats(enabled: boolean) {
  return useQuery(orpc.admin.stats.queryOptions({ enabled, retry: false }));
}

function useInvalidateAdmin() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.admin.key() });
}

export function useSetActive() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.setActive.mutationOptions({ onSuccess: invalidate }));
}

export function useSetPremium() {
  const invalidate = useInvalidateAdmin();
  return useMutation(orpc.admin.setPremium.mutationOptions({ onSuccess: invalidate }));
}
