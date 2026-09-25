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
    <div className="flex h-full flex-col bg-gradient-to-b from-white/[0.025] to-transparent">
      <div className="flex items-center justify-between px-5 py-5">
        <NorviWordmark />
        <span className="rounded-full border border-white/[0.07] bg-white/[0.035] px-2 py-1 text-[9px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
          local
        </span>
      </div>

      <div className="px-3.5">
        <button
          type="button"
          onClick={onNewChat}
          className="group flex w-full items-center gap-2.5 rounded-2xl border border-primary/20 bg-[linear-gradient(145deg,rgba(255,122,89,0.11),rgba(255,122,89,0.055))] px-3.5 py-3 text-sm font-semibold shadow-[0_16px_40px_-30px_rgba(255,122,89,0.75)] transition hover:-translate-y-px hover:border-primary/40 hover:bg-primary/[0.12]"
        >
          <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_8px_22px_-12px_rgba(255,122,89,0.9)]">
            <Plus className="size-4" />
          </span>
          Neuer Chat
        </button>
      </div>

      <div className="mt-6 flex items-center justify-between px-5 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground/70 uppercase">
        <span>Verlauf</span>
        <span>{chats.length}</span>
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
                        active
                          ? "border border-white/[0.055] bg-[linear-gradient(90deg,rgba(255,122,89,0.10),rgba(255,255,255,0.025))] text-foreground shadow-[inset_3px_0_0_rgba(255,122,89,0.72)]"
                          : "border border-transparent hover:border-white/[0.035] hover:bg-secondary/55"
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
    </div>
  );
}
