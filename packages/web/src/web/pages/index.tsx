import { useEffect, useState } from "react";
import { Check, Eye, Menu, Mic2, Share2, X } from "lucide-react";
import { AccountMenu } from "../components/account-menu";
import { ChatPane } from "../components/chat/chat-pane";
import { NorviMark } from "../components/chat/norvi-mark";
import { Sidebar } from "../components/chat/sidebar";
import { getDeviceId } from "../lib/device";
import { isDesktop } from "../lib/desktop";
import {
  getAssistantSettings,
  subscribeAssistantSettings,
} from "../lib/desktop-assistant";
import { useCapabilities } from "../queries/capabilities";
import { useChats, useDeleteChat, useRenameChat } from "../queries/chats";
import { useModel } from "../queries/model";

interface Session {
  key: string;
  chatId: string | null;
}

function Index() {
  const model = useModel();
  const capabilities = useCapabilities();
  const chats = useChats();
  const renameChat = useRenameChat();
  const deleteChat = useDeleteChat();

  const [session, setSession] = useState<Session>({ key: "new-initial", chatId: null });
  const [activeId, setActiveId] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [shareState, setShareState] = useState<"idle" | "shared" | "copied" | "error">("idle");
  const [desktopAssistant, setDesktopAssistant] = useState(getAssistantSettings);

  useEffect(() => subscribeAssistantSettings(setDesktopAssistant), []);

  const agentName = isDesktop()
    ? desktopAssistant.assistantName
    : (model.data?.agent ?? "NORVI");
  const healthState = capabilities.isPending
    ? "connecting"
    : capabilities.isError
      ? "offline"
      : capabilities.data?.aiOnline === false
        ? "ai-offline"
        : "online";

  const openChat = (id: string) => {
    setSession({ key: id, chatId: id });
    setActiveId(id);
    setDrawer(false);
  };

  const newChat = () => {
    setSession({ key: `new-${Date.now()}`, chatId: null });
    setActiveId(null);
    setDrawer(false);
  };

  const sharePublicLink = async () => {
    const publicUrl = capabilities.data?.publicUrl || window.location.href;

    try {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: "NORVI",
            text: "NORVI öffnen",
            url: publicUrl,
          });
          setShareState("shared");
          window.setTimeout(() => setShareState("idle"), 1600);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }

      try {
        await navigator.clipboard.writeText(publicUrl);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = publicUrl;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        if (!copied) throw new Error("copy failed");
      }

      setShareState("copied");
      window.setTimeout(() => setShareState("idle"), 1600);
    } catch {
      setShareState("error");
      window.setTimeout(() => setShareState("idle"), 2200);
    }
  };

  const list = (chats.data ?? []).map((chat) => ({
    id: chat.id,
    title: chat.title,
    updatedAt: new Date(chat.updatedAt),
  }));

  const sidebar = (
    <Sidebar
      chats={list}
      loading={chats.isLoading}
      activeId={activeId}
      onNewChat={newChat}
      onSelect={openChat}
      onRename={(id, title) => renameChat.mutate({ deviceId: getDeviceId(), id, title })}
      onDelete={(id) => {
        deleteChat.mutate(
          { deviceId: getDeviceId(), id },
          { onSuccess: () => id === activeId && newChat() },
        );
      }}
      deletingId={deleteChat.isPending ? (deleteChat.variables?.id ?? null) : null}
    />
  );

  const statusLabel =
    healthState === "online"
      ? capabilities.data?.localOnly
        ? "Lokal"
        : "Online"
      : healthState === "ai-offline"
        ? "Dienst offline"
        : healthState === "offline"
          ? "Offline"
          : "Verbinde";

  return (
    <div className="norvi-app relative flex h-dvh overflow-hidden bg-background">
      <aside className="sidebar-shell relative hidden w-[17.25rem] shrink-0 lg:block">
        {sidebar}
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-black/55 backdrop-blur-xl"
          />
          <div className="sidebar-shell rise absolute inset-y-0 left-0 w-[86%] max-w-[18.5rem] shadow-[24px_0_90px_-34px_rgba(0,0,0,1)]">
            <button
              type="button"
              aria-label="Menü schließen"
              onClick={() => setDrawer(false)}
              className="icon-action absolute right-3 top-4 z-20 flex size-8 items-center justify-center rounded-xl text-muted-foreground transition hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="glass-header relative z-30 mx-2 mt-2 rounded-[1.15rem] sm:mx-3 sm:mt-3">
          <div className="mx-auto flex h-[3.75rem] w-full max-w-[92rem] items-center gap-3 px-3.5 sm:px-5">
            <button
              type="button"
              aria-label="Chat-Verlauf öffnen"
              onClick={() => setDrawer(true)}
              className="icon-action -ml-0.5 flex size-9 items-center justify-center rounded-xl text-muted-foreground transition lg:hidden"
            >
              <Menu className="size-4.5" />
            </button>

            <div className="flex min-w-0 items-center gap-2.5">
              <NorviMark className="size-8" />
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="truncate text-[0.96rem] font-semibold tracking-[-0.03em]">
                  {agentName}
                </span>
                <span className="system-pill flex items-center gap-1.5 rounded-full px-2 py-1 text-[9px] text-muted-foreground">
                  <span
                    className={`size-1.5 rounded-full ${
                      healthState === "online"
                        ? "status-dot bg-green-400"
                        : healthState === "connecting"
                          ? "bg-amber-400"
                          : "bg-red-400"
                    }`}
                  />
                  {statusLabel}
                </span>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              {capabilities.data?.vision && (
                <span title="Bilder verfügbar" className="icon-action hidden size-9 items-center justify-center rounded-xl text-muted-foreground sm:flex">
                  <Eye className="size-4" />
                </span>
              )}
              {capabilities.data?.stt && (
                <span title="Spracheingabe verfügbar" className="icon-action hidden size-9 items-center justify-center rounded-xl text-muted-foreground sm:flex">
                  <Mic2 className="size-4" />
                </span>
              )}
              {capabilities.data?.publicUrl && (
                <button
                  type="button"
                  onClick={() => void sharePublicLink()}
                  title={
                    shareState === "shared"
                      ? "Geteilt"
                      : shareState === "copied"
                        ? "Link kopiert"
                        : shareState === "error"
                          ? "Teilen fehlgeschlagen"
                          : "NORVI teilen"
                  }
                  aria-label="NORVI teilen"
                  className="icon-action flex size-9 items-center justify-center rounded-xl text-muted-foreground transition"
                >
                  {shareState === "shared" || shareState === "copied" ? (
                    <Check className="size-4 text-green-400" />
                  ) : (
                    <Share2 className="size-4" />
                  )}
                </button>
              )}
              <AccountMenu />
            </div>
          </div>
        </header>

        <ChatPane
          sessionKey={session.key}
          chatId={session.chatId}
          agentName={agentName}
          onCreated={(id) => setActiveId(id)}
        />
      </div>
    </div>
  );
}

export default Index;
