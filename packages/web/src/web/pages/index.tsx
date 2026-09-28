import { useState } from "react";
import { Cpu, Eye, Menu, Mic2, Share2, Sparkles, X } from "lucide-react";
import { AccountMenu } from "../components/account-menu";
import { ChatPane } from "../components/chat/chat-pane";
import { NorviMark } from "../components/chat/norvi-mark";
import { Sidebar } from "../components/chat/sidebar";
import { getDeviceId } from "../lib/device";
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
  const [linkCopied, setLinkCopied] = useState(false);

  const agentName = model.data?.agent ?? "NORVI";
  const modelLabel = model.isLoading ? "verbinde…" : (model.data?.label ?? "NORVI AI");
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

  const copyPublicLink = async () => {
    const publicUrl = capabilities.data?.publicUrl;
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1400);
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

  const healthText =
    healthState === "online"
      ? "Online"
      : healthState === "ai-offline"
        ? "KI offline"
        : healthState === "offline"
          ? "Offline"
          : "Verbinde";

  return (
    <div className="norvi-app relative flex h-dvh overflow-hidden bg-background">
      <aside className="sidebar-shell relative hidden w-[19.5rem] shrink-0 border-r border-white/[0.055] md:block">
        {sidebar}
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-black/68 backdrop-blur-md"
          />
          <div className="sidebar-shell rise absolute inset-y-0 left-0 w-[84%] max-w-[20rem] border-r border-white/[0.07] shadow-[24px_0_80px_-34px_rgba(0,0,0,1)]">
            <button
              type="button"
              aria-label="Menü schließen"
              onClick={() => setDrawer(false)}
              className="absolute right-3 top-4 z-20 flex size-8 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.025] text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="relative flex min-w-0 flex-1 flex-col">
        <header className="glass-header relative z-30">
          <div className="mx-auto flex h-[4.35rem] w-full max-w-[92rem] items-center gap-3 px-3.5 sm:px-6">
            <button
              type="button"
              aria-label="Chat-Verlauf öffnen"
              onClick={() => setDrawer(true)}
              className="icon-action -ml-0.5 flex size-9 items-center justify-center rounded-xl text-muted-foreground transition md:hidden"
            >
              <Menu className="size-4.5" />
            </button>

            <div className="flex min-w-0 items-center gap-3">
              <NorviMark className="size-9" />
              <div className="min-w-0 leading-tight">
                <div className="flex items-center gap-2">
                  <div className="truncate text-[0.97rem] font-semibold tracking-[-0.025em]">
                    {agentName}
                  </div>
                  <span
                    className={
                      healthState === "online"
                        ? "system-pill flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold text-green-300/90"
                        : healthState === "offline" || healthState === "ai-offline"
                          ? "flex items-center gap-1.5 rounded-full border border-red-400/15 bg-red-400/[0.055] px-2 py-0.5 text-[9px] font-semibold text-red-300/90"
                          : "flex items-center gap-1.5 rounded-full border border-amber-400/15 bg-amber-400/[0.055] px-2 py-0.5 text-[9px] font-semibold text-amber-300/90"
                    }
                    title={
                      healthState === "online"
                        ? "NORVI und lokaler KI-Dienst sind erreichbar"
                        : healthState === "ai-offline"
                          ? "NORVI läuft, aber der KI-Dienst ist nicht erreichbar"
                          : healthState === "offline"
                            ? "NORVI-Server nicht erreichbar"
                            : "Verbindung wird geprüft"
                    }
                  >
                    <span
                      className={
                        healthState === "online"
                          ? "status-dot size-1.5 rounded-full bg-green-400"
                          : healthState === "offline" || healthState === "ai-offline"
                            ? "size-1.5 rounded-full bg-red-400"
                            : "size-1.5 animate-pulse rounded-full bg-amber-400"
                      }
                    />
                    {healthText}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5 truncate text-[10px] tracking-[0.04em] text-muted-foreground/70">
                  <Sparkles className="size-2.5 text-primary/75" />
                  {modelLabel}
                </div>
              </div>
            </div>

            <div className="ml-auto hidden items-center gap-1.5 sm:flex">
              {capabilities.data?.localAi && (
                <span className="capability-pill flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] text-muted-foreground">
                  <Cpu className="size-3 text-primary" />
                  Local
                </span>
              )}
              {capabilities.data?.vision && (
                <span className="capability-pill flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] text-muted-foreground">
                  <Eye className="size-3 text-sky-300" />
                  Vision
                </span>
              )}
              {capabilities.data?.stt && (
                <span className="capability-pill flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[10px] text-muted-foreground">
                  <Mic2 className="size-3 text-violet-300" />
                  Voice
                </span>
              )}
            </div>

            {capabilities.data?.publicUrl && (
              <button
                type="button"
                onClick={() => void copyPublicLink()}
                title="Öffentlichen NORVI-Link kopieren"
                aria-label="Öffentlichen NORVI-Link kopieren"
                className="icon-action flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[10px] font-medium text-muted-foreground transition hover:text-foreground"
              >
                <Share2 className="size-3.5" />
                <span className="hidden lg:inline">{linkCopied ? "Kopiert" : "Teilen"}</span>
              </button>
            )}

            <AccountMenu />
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