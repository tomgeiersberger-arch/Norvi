import { useQuery } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** Which optional features this NORVI installation has configured (vision, speech). */
export function useCapabilities() {
  return useQuery(orpc.capabilities.get.queryOptions({ staleTime: 5 * 60 * 1000 }));
}
