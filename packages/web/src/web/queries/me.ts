import { useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** Current NORVI AI account, or null when signed out. */
export function useMe() {
  return useQuery(orpc.me.queryOptions({ retry: false, staleTime: 30_000 }));
}

export function useResetSession() {
  const queryClient = useQueryClient();
  return () => queryClient.clear();
}
