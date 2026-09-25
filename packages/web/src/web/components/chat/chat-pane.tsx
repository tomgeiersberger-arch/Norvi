import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ChevronDown, Loader2, RotateCcw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { orpc } from "../../lib/api";
import { getDeviceId } from "../../lib/device";
import { useChatMessages, useCreateChat } from "../../queries/chats";
import { useCapabilities } from "../../queries/capabilities";
import type { UploadedImage } from "../../lib/uploads";
import { Composer } from "./composer";
import { EmptyState } from "./empty-state";
import { Message, TypingIndicator } from "./message";

interface StoredMessage {
  id: string;
  role: string;
  content: string;
  attachments?: string | null;
}

/** Stored attachments come back as a JSON string — bad data must never break the chat. */
function parseAttachments(raw: string | null | undefined): { url: string; mediaType: string }[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is { url: string; mediaType: string } =>
        typeof (item as { url?: unknown })?.url === "string" &&
        typeof (item as { mediaType?: unknown })?.mediaType === "string",
    );
  } catch {
    return [];
  }
}

/** DB rows -> UIMessage shape the chat hook expects. */
function toUIMessages(rows: StoredMessage[] | undefined): UIMessage[] {
  return (rows ?? []).map((row) => ({
    id: row.id,
    role: row.role === "assistant" ? "assistant" : "user",
    parts: [
      // Images first so the reloaded history looks like the live conversation.
      ...parseAttachments(row.attachments).map((image) => ({
        type: "file" as const,
        url: image.url,
        mediaType: image.mediaType,
      })),
      { type: "text" as const, text: row.content },
    ],
  })) as UIMessage[];
}

interface ChatPaneProps {
  /** Key that forces a fresh session (chat id, or a "new-…" token). */
  sessionKey: string;
  chatId: string | null;
  agentName: string;
  onCreated: (id: string) => void;
}

export function ChatPane({ sessionKey, chatId, agentName, onCreated }: ChatPaneProps) {
  const stored = useChatMessages(chatId);

  if (chatId && stored.isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <Loader2 className="size-5 animate-spin" />
      </div>
    );
  }

  return (
    <ChatSession
      key={sessionKey}
      chatId={chatId}
      agentName={agentName}
      initialMessages={toUIMessages(stored.data)}
      onCreated={onCreated}
    />
  );
}

interface ChatSessionProps {
  chatId: string | null;
  agentName: string;
  initialMessages: UIMessage[];
  onCreated: (id: string) => void;
}

function ChatSession({ chatId, agentName, initialMessages, onCreated }: ChatSessionProps) {
  const queryClient = useQueryClient();
  const createChat = useCreateChat();
  const capabilities = useCapabilities();
  const [id, setId] = useState<string | null>(chatId);
  const [nearBottom, setNearBottom] = useState(true);
  const idRef = useRef<string | null>(chatId);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, stop, regenerate, status, error } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: "/api/agent/messages" }),
  });

  const busy = status === "submitted" || status === "streaming";
  const last = messages.at(-1);
  const waitingForFirstToken = status === "submitted" || (last?.role === "user" && busy);
  const analyzingImage =
    waitingForFirstToken &&
    last?.role === "user" &&
    last.parts.some((part) => part.type === "file" && part.mediaType?.startsWith("image/"));

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
    setNearBottom(true);
  };

  useEffect(() => {
    if (!nearBottom && status !== "submitted") return;
    scrollToBottom(messages.length > 1 ? "smooth" : "auto");
  }, [messages, status, nearBottom]);

  // Refresh the sidebar once a turn is done (auto-title, ordering).
  useEffect(() => {
    if (status !== "ready" || !idRef.current) return;
    void queryClient.invalidateQueries({ queryKey: orpc.chats.key() });
  }, [status, queryClient]);

  const send = async (text: string, images: UploadedImage[] = []) => {
    const deviceId = getDeviceId();
    let target = idRef.current;

    if (!target) {
      const chat = await createChat.mutateAsync({ deviceId });
      target = chat.id;
      idRef.current = chat.id;
      setId(chat.id);
      onCreated(chat.id);
    }

    if (images.length === 0) {
      await sendMessage({ text }, { body: { chatId: target, deviceId } });
      return;
    }

    // Images travel as `file` parts next to the text of the same turn.
    await sendMessage(
      {
        role: "user",
        parts: [
          ...images.map((image) => ({
            type: "file" as const,
            url: image.url,
            mediaType: image.mediaType,
          })),
          { type: "text" as const, text },
        ],
      },
      { body: { chatId: target, deviceId } },
    );
  };

  const retry = () => {
    const deviceId = getDeviceId();
    void regenerate({ body: { chatId: idRef.current, deviceId } });
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        onScroll={() => {
          const el = scrollRef.current;
          if (!el) return;
          setNearBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 140);
        }}
        className="scroll-slim min-h-0 flex-1 overflow-y-auto"
      >
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          {messages.length === 0 ? (
            <EmptyState
              agentName={agentName}
              onPick={(t) => void send(t)}
              vision={capabilities.data?.vision ?? false}
              stt={capabilities.data?.stt ?? false}
            />
          ) : (
            <div className="flex flex-col gap-8 py-8">
              {messages.map((message, i) => (
                <Message
                  key={message.id || i}
                  message={message}
                  agentName={agentName}
                  streaming={status === "streaming" && i === messages.length - 1}
                />
              ))}
              {waitingForFirstToken && (
                <TypingIndicator agentName={agentName} vision={analyzingImage} />
              )}
              {error && (
                <div className="rise rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3.5 text-sm">
                  <p className="text-destructive">{error.message}</p>
                  <button
                    type="button"
                    onClick={retry}
                    className="mt-3 flex items-center gap-1.5 rounded-full border border-destructive/40 px-3 py-1.5 text-xs text-destructive transition hover:bg-destructive/15"
                  >
                    <RotateCcw className="size-3.5" />
                    Nochmal versuchen
                  </button>
                </div>
              )}
              <div className="h-2" />
            </div>
          )}
        </div>
      </div>

      {!nearBottom && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          aria-label="Zum neuesten Beitrag springen"
          className="glass-panel absolute right-5 bottom-[8.3rem] z-20 flex size-9 items-center justify-center rounded-full text-muted-foreground transition hover:text-foreground sm:right-8"
        >
          <ChevronDown className="size-4" />
        </button>
      )}

      <div className="bg-gradient-to-t from-background via-background/98 to-transparent pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-6">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <Composer
            agentName={agentName}
            onSend={(text, images) => void send(text, images)}
            onStop={stop}
            busy={busy}
            vision={capabilities.data?.vision ?? true}
            stt={capabilities.data?.stt ?? false}
          />
        </div>
      </div>
      <span className="sr-only">{id ? `Chat ${id}` : "Neuer Chat"}</span>
    </div>
  );
}
