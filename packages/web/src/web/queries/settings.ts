import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

/** Personal NORVI AI settings (model + answer style). */
export function useSettings(enabled: boolean) {
  return useQuery(orpc.settings.get.queryOptions({ enabled, retry: false }));
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation(
    orpc.settings.update.mutationOptions({
      onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.settings.key() }),
    }),
  );
}
