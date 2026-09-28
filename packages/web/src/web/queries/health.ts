import { useQuery } from "@tanstack/react-query";

/**
 * Lightweight app-health probe for the header status badge.
 * Unlike the model/config queries this keeps polling, so a running browser
 * notices when the self-hosted NORVI server disappears and comes back.
 */
export function useHealth() {
  return useQuery({
    queryKey: ["norvi-health"],
    queryFn: async () => {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw new Error(`Healthcheck fehlgeschlagen (HTTP ${response.status})`);
      const data = (await response.json()) as { status?: string };
      if (data.status !== "ok") throw new Error("NORVI meldet keinen gesunden Status.");
      return true;
    },
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
