import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/api";

/** Optional features this NORVI server has configured (image understanding, speech). */
export function useCapabilities() {
  return useQuery(orpc.capabilities.get.queryOptions({ staleTime: 5 * 60 * 1000 }));
}
