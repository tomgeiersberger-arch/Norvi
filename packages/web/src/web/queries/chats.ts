import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { getDeviceId } from "../lib/device";

/** All chats of this device, newest first. */
export function useChats() {
  return useQuery(orpc.chats.list.queryOptions({ input: { deviceId: getDeviceId() } }));
}

/** Stored messages of one chat (skipped for a fresh, unsaved chat). */
export function useChatMessages(id: string | null) {
  return useQuery(
    orpc.chats.messages.queryOptions({
      input: { deviceId: getDeviceId(), id: id ?? "" },
      enabled: Boolean(id),
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
