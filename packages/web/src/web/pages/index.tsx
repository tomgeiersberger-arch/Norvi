import { useState } from "react";
import { Cpu, Eye, Menu, Mic2, X } from "lucide-react";
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

  const agentName = model.data?.agent ?? "NORVI";
  const modelLabel = model.isLoading ? "verbinde…" : (model.data?.label ?? "NORVI AI");

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

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden w-[18.5rem] shrink-0 border-r border-white/[0.06] bg-black/10 md:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {drawer && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            aria-label="Menü schließen"
            onClick={() => setDrawer(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <div className="rise absolute inset-y-0 left-0 w-[80%] max-w-[19rem] border-r border-border bg-background shadow-2xl">
            <button
              type="button"
              aria-label="Menü schließen"
              onClick={() => setDrawer(false)}
              className="absolute top-4 right-3 z-10 rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
            >
              <X className="size-4" />
            </button>
            {sidebar}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-10 border-b border-white/[0.06] bg-background/55 backdrop-blur-2xl">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3.5 sm:px-6">
            <button
              type="button"
              aria-label="Chat-Verlauf öffnen"
              onClick={() => setDrawer(true)}
              className="-ml-1 rounded-lg p-1.5 text-muted-foreground transition hover:bg-secondary hover:text-foreground md:hidden"
            >
              <Menu className="size-5" />
            </button>
            <NorviMark className="size-8" />
            <div className="min-w-0 leading-tight">
              <div className="flex items-center gap-2">
                <div className="truncate text-[0.95rem] font-semibold tracking-tight">{agentName}</div>
                <span className="status-dot size-1.5 rounded-full bg-green-400" title="NORVI ist online" />
              </div>
              <div className="truncate text-[11px] text-muted-foreground">{modelLabel}</div>
            </div>

            <div className="ml-auto hidden items-center gap-1.5 sm:flex">
              {capabilities.data?.localAi && (
                <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-1 text-[10.5px] text-muted-foreground">
                  <Cpu className="size-3" />
                  Lokal
                </span>
              )}
              {capabilities.data?.vision && (
                <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-1 text-[10.5px] text-muted-foreground">
                  <Eye className="size-3" />
                  Vision
                </span>
              )}
              {capabilities.data?.stt && (
                <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.035] px-2.5 py-1 text-[10.5px] text-muted-foreground">
                  <Mic2 className="size-3" />
                  Voice
                </span>
              )}
            </div>
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
