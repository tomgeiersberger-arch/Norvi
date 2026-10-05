import {
  Brain,
  Keyboard,
  Mic,
  MonitorUp,
  Sparkles,
  Zap,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import type { DesktopAssistantSettings } from "../lib/desktop-assistant";

interface DesktopSkillsPanelProps {
  assistant: DesktopAssistantSettings;
  setAssistant: Dispatch<SetStateAction<DesktopAssistantSettings>>;
}

export function DesktopSkillsPanel({ assistant, setAssistant }: DesktopSkillsPanelProps) {
  const skills = [
    {
      id: "voice",
      label: "Voice",
      hint: "Mikrofon, Wake-Phrase und Push-to-Talk",
      icon: Mic,
      enabled: assistant.microphoneEnabled,
      toggle: (enabled: boolean) =>
        setAssistant((current) => ({
          ...current,
          microphoneEnabled: enabled,
          wakeEnabled: enabled ? current.wakeEnabled : false,
          conversationMode: enabled ? current.conversationMode : false,
        })),
    },
    {
      id: "screen",
      label: "Screen",
      hint: "Bildschirm nur nach deinem Klick analysieren",
      icon: MonitorUp,
      enabled: assistant.screenCaptureEnabled,
      toggle: (enabled: boolean) =>
        setAssistant((current) => ({ ...current, screenCaptureEnabled: enabled })),
    },
    {
      id: "actions",
      label: "Actions",
      hint: "Freigegebene Apps, Programme und Websites starten",
      icon: Zap,
      enabled: assistant.desktopActionsEnabled,
      toggle: (enabled: boolean) =>
        setAssistant((current) => ({ ...current, desktopActionsEnabled: enabled })),
    },
    {
      id: "memory",
      label: "Memory",
      hint: "Explizite lokale Erinnerungen als Kontext verwenden",
      icon: Brain,
      enabled: assistant.memoryEnabled,
      toggle: (enabled: boolean) =>
        setAssistant((current) => ({ ...current, memoryEnabled: enabled })),
    },
    {
      id: "quick",
      label: "Quick Access",
      hint: "Alt + Leertaste bringt NORVI nach vorne",
      icon: Keyboard,
      enabled: assistant.quickShortcutEnabled,
      toggle: (enabled: boolean) =>
        setAssistant((current) => ({ ...current, quickShortcutEnabled: enabled })),
    },
  ];

  return (
    <div className="rounded-2xl border border-white/[0.065] bg-white/[0.018] p-4">
      <div className="mb-3 flex items-start gap-3">
        <div className="icon-action flex size-9 shrink-0 items-center justify-center rounded-xl text-primary">
          <Sparkles className="size-4" />
        </div>
        <div>
          <div className="text-[13px] font-semibold">NORVI Skills</div>
          <p className="mt-0.5 text-[10.5px] leading-4 text-muted-foreground">
            Lokale Skills einzeln aktivieren. Keine fremden Scripts und kein generischer Shell-Zugriff.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {skills.map(({ id, label, hint, icon: Icon, enabled, toggle }) => (
          <label
            key={id}
            className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-white/[0.05] bg-black/10 px-3 py-2.5"
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => toggle(event.target.checked)}
              aria-label={label + " Skill"}
              className="mt-0.5 size-4 accent-[var(--primary)]"
            />
            <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
            <span className="min-w-0">
              <span className="block text-[11px] font-medium">{label}</span>
              <span className="block text-[9.5px] leading-4 text-muted-foreground">{hint}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
