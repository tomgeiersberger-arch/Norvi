import { useEffect, useRef, useState } from "react";
import { Check, Command, MessageSquare, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { NorviWordmark } from "./norvi-mark";

export interface ChatListItem {
  id: string;
  title: string;
  updatedAt: Date;
}

interface SidebarProps {
  chats: ChatListItem[];
  loading: boolean;
  activeId: string | null;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
}

export function Sidebar({
  chats,
  loading,
  activeId,
  onNewChat,
  onSelect,
  onRename,
  onDelete,
  deletingId,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filteredChats = query.trim()
    ? chats.filter((chat) => chat.title.toLowerCase().includes(query.trim().toLowerCase()))
    : chats;

  const startEdit = (chat: ChatListItem) => {
    setConfirmId(null);
    setEditingId(chat.id);
    setDraft(chat.title);
  };

  const commit = () => {
    const title = draft.trim();
    if (editingId && title) onRename(editingId, title);
    setEditingId(null);
  };

  return (
    <div className="relative z-10 flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <NorviWordmark />
        <span className="system-pill flex items-center gap-1.5 rounded-full px-2 py-1 text-[8.5px] font-semibold tracking-[0.13em] text-green-300/80 uppercase">
          <span className="status-dot size-1.5 rounded-full bg-green-400" />
          Local
        </span>
      </div>

      <div className="px-3.5">
        <button
          type="button"
          onClick={onNewChat}
          className="group flex w-full items-center gap-2.5 rounded-[1.15rem] border border-primary/20 bg-[linear-gradient(145deg,rgba(255,125,87,0.14),rgba(255,125,87,0.055))] px-3 py-2.5 text-[13px] font-semibold shadow-[0_18px_50px_-34px_rgba(255,125,87,0.85),inset_0_1px_0_rgba(255,255,255,0.05)] transition duration-300 hover:-translate-y-0.5 hover:border-primary/38 hover:bg-primary/[0.12]"
        >
          <span className="send-glow flex size-8 items-center justify-center rounded-xl text-primary-foreground">
            <Plus className="size-4" />
          </span>
          Neuer Chat
        </button>
      </div>

      <div className="mt-4 px-3.5">
        <label className="capability-pill flex items-center gap-2 rounded-xl px-3 py-2.5 text-muted-foreground transition focus-within:border-primary/25 focus-within:bg-white/[0.04] focus-within:text-foreground">
          <Search className="size-3.5 shrink-0" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Chats durchsuchen"
            aria-label="Chats durchsuchen"
            className="min-w-0 flex-1 bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground/60"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                searchRef.current?.focus();
              }}
              aria-label="Suche leeren"
              className="rounded p-0.5 text-muted-foreground transition hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </label>
      </div>

      <div className="mt-5 flex items-center justify-between px-5 text-[9px] font-semibold tracking-[0.2em] text-muted-foreground/55 uppercase">
        <span>Verlauf</span>
        <span>{query ? `${filteredChats.length}/${chats.length}` : chats.length}</span>
      </div>

      <div className="scroll-slim mt-2 flex-1 overflow-y-auto px-2 pb-4">
        {loading ? (
          <div className="space-y-1.5 px-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        ) : chats.length === 0 ? (
          <p className="px-2 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
            Noch keine Chats. Deine Unterhaltungen erscheinen hier automatisch.
          </p>
        ) : filteredChats.length === 0 ? (
          <p className="px-2 py-3 text-[12.5px] leading-relaxed text-muted-foreground">
            Kein Chat passt zu „{query.trim()}“.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filteredChats.map((chat) => {
              const active = chat.id === activeId;
              const editing = chat.id === editingId;

              return (
                <li key={chat.id}>
                  {editing ? (
                    <div className="flex items-center gap-1 rounded-lg bg-secondary/70 px-2 py-1.5">
                      <input
                        ref={inputRef}
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        aria-label="Chat umbenennen"
                        className="min-w-0 flex-1 bg-transparent px-1 text-[13px] outline-none"
                      />
                      <button
                        type="button"
                        onClick={commit}
                        aria-label="Namen speichern"
                        className="rounded p-1 text-primary hover:bg-white/5"
                      >
                        <Check className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        aria-label="Abbrechen"
                        className="rounded p-1 text-muted-foreground hover:bg-white/5"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 transition ${
                        active
                          ? "border border-primary/14 bg-[linear-gradient(90deg,rgba(255,125,87,0.105),rgba(255,255,255,0.025))] text-foreground shadow-[inset_2px_0_0_rgba(255,125,87,0.8),0_12px_34px_-28px_rgba(255,125,87,0.55)]"
                          : "border border-transparent hover:border-white/[0.045] hover:bg-white/[0.028]"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelect(chat.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left"
                      >
                        <MessageSquare
                          className={`size-3.5 shrink-0 ${active ? "text-primary" : "text-muted-foreground"}`}
                        />
                        <span className="truncate text-[13px]">{chat.title}</span>
                      </button>

                      {confirmId === chat.id ? (
                        <span className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(chat.id);
                              setConfirmId(null);
                            }}
                            disabled={deletingId === chat.id}
                            className="rounded px-1.5 py-0.5 text-[11px] text-destructive hover:bg-destructive/15 disabled:opacity-50"
                          >
                            {deletingId === chat.id ? "…" : "Löschen"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(null)}
                            aria-label="Abbrechen"
                            className="rounded p-1 text-muted-foreground hover:bg-white/5"
                          >
                            <X className="size-3.5" />
                          </button>
                        </span>
                      ) : (
                        <span className="flex shrink-0 items-center gap-0.5 opacity-60 transition md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100">
                          <button
                            type="button"
                            onClick={() => startEdit(chat)}
                            aria-label="Chat umbenennen"
                            className="rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-foreground"
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmId(chat.id)}
                            aria-label="Chat löschen"
                            className="rounded p-1 text-muted-foreground hover:bg-white/5 hover:text-destructive"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </span>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mx-3 mb-3 flex items-center justify-between rounded-xl border border-white/[0.045] bg-white/[0.018] px-3 py-2 text-[9.5px] text-muted-foreground/55">
        <span className="flex items-center gap-1.5">
          <Command className="size-3" />
          Ctrl/⌘ K
        </span>
        <span>Private AI</span>
      </div>
    </div>
  );
}