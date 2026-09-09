import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/lib/api";
import { getDeviceId } from "@/lib/device";

/** Resolved once per app start, then reused by every chat query. */
export function useDeviceId() {
  return useQuery({
    queryKey: ["device-id"],
    queryFn: getDeviceId,
    staleTime: Infinity,
  });
}

export function useChats(deviceId: string | undefined) {
  return useQuery(
    orpc.chats.list.queryOptions({
      input: { deviceId: deviceId ?? "" },
      enabled: Boolean(deviceId),
    }),
  );
}

export function useChatMessages(deviceId: string | undefined, id: string | null) {
  return useQuery(
    orpc.chats.messages.queryOptions({
      input: { deviceId: deviceId ?? "", id: id ?? "" },
      enabled: Boolean(deviceId && id),
      staleTime: 0,
    }),
  );
}

function useInvalidateChats() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: orpc.chats.key() });
}

export function useCreateChat() {
  const invalidate = useInvalidateChats();
  return useMutation(orpc.chats.create.mutationOptions({ onSuccess: invalidate }));
}

export function useRenameChat() {
  const invalidate = useInvalidateChats();
  return useMutation(orpc.chats.rename.mutationOptions({ onSuccess: invalidate }));
}

export function useDeleteChat() {
  const invalidate = useInvalidateChats();
  return useMutation(orpc.chats.remove.mutationOptions({ onSuccess: invalidate }));
}
