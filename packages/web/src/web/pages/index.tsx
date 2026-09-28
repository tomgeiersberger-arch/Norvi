import { useState } from "react";
import { Eye, Menu, Mic2, Share2, X } from "lucide-react";
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

  const statusLabel =
    healthState === "online"
      ? "Online"
      : healthState === "ai-offline"
        ? "Dienst offline"
        : healthState === "offline"
          ? "Offline"
          : "Verbinde";

  return (
    <div className="norvi-app relative flex h-dvh overflow-hidden bg-background">
      <aside className="sidebar-shell relative hidden w-[18.75rem] shrink-0 border-r border-white/[0.06] md:block">
        {sidebar}
      </aside>

      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
          />
          <div className="sidebar-shell rise absolute inset-y-0 left-0 w-[84%] max-w-[19rem] border-r border-white/[0.07] shadow-2xl">
            <button
              type="button"
              aria-label="Menü schließen"
              onClick={() => setDrawer(false)}
              className="absolute right-3 top-4 z-20 flex size-8 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-white/[0.05] hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="glass-header relative z-30">
          <div className="mx-auto flex h-16 w-full max-w-[90rem] items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              aria-label="Chat-Verlauf öffnen"
              onClick={() => setDrawer(true)}
              className="icon-action -ml-1 flex size-9 items-center justify-center rounded-lg text-muted-foreground transition md:hidden"
            >
              <Menu className="size-4.5" />
            </button>

            <NorviMark className="size-8" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[0.95rem] font-semibold tracking-[-0.02em]">{agentName}</span>
                <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                  <span
                    className={`size-1.5 rounded-full ${
                      healthState === "online"
                        ? "bg-green-400"
                        : healthState === "connecting"
                          ? "bg-amber-400"
                          : "bg-red-400"
                    }`}
                  />
                  {statusLabel}
                </span>
              </div>
            </div>

            <div className="ml-auto flex items-center gap-1">
              {capabilities.data?.vision && (
                <span title="Bilder verfügbar" className="icon-action hidden size-9 items-center justify-center rounded-lg text-muted-foreground sm:flex">
                  <Eye className="size-4" />
                </span>
              )}
              {capabilities.data?.stt && (
                <span title="Spracheingabe verfügbar" className="icon-action hidden size-9 items-center justify-center rounded-lg text-muted-foreground sm:flex">
                  <Mic2 className="size-4" />
                </span>
              )}
              {capabilities.data?.publicUrl && (
                <button
                  type="button"
                  onClick={() => void copyPublicLink()}
                  title="NORVI-Link kopieren"
                  aria-label="NORVI-Link kopieren"
                  className="icon-action flex size-9 items-center justify-center rounded-lg text-muted-foreground transition"
                >
                  <Share2 className="size-4" />
                  <span className="sr-only">{linkCopied ? "Kopiert" : "Teilen"}</span>
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