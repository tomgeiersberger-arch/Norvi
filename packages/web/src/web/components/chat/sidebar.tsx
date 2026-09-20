import { useEffect, useRef, useState } from "react";
import { Check, MessageSquare, Pencil, Plus, Trash2, X } from "lucide-react";
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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

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
    <div className="flex h-full flex-col bg-card/40">
      <div className="flex items-center justify-between px-4 py-4">
        <NorviWordmark />
      </div>

      <div className="px-3">
        <button
          type="button"
          onClick={onNewChat}
          className="hover-lift group flex w-full items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2.5 text-sm font-medium text-foreground hover:border-primary/50 hover:bg-primary/15 hover:shadow-[0_16px_40px_-24px_rgba(217,119,87,0.8)]"
        >
          <span className="flex size-5 items-center justify-center rounded-md bg-primary/20 text-primary transition group-hover:bg-primary/30">
            <Plus className="size-3.5" />
          </span>
          Neuer Chat
        </button>
      </div>

      <div className="mt-5 px-4 text-[10.5px] font-medium tracking-wider text-muted-foreground/80 uppercase">
        Verlauf
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
        ) : (
          <ul className="space-y-0.5">
            {chats.map((chat) => {
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
                        active ? "bg-secondary text-foreground" : "hover:bg-secondary/60"
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
                        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
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
    </div>
  );
}
