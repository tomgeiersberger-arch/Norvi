import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/lib/api";

/** Which model the backend chat route is wired to (used for the header label). */
export function useModel() {
  return useQuery(orpc.model.queryOptions({ staleTime: Infinity }));
}
