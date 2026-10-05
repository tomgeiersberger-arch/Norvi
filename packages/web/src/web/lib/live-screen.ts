export const LIVE_SCREEN_EVENT = "norvi:live-screen";

export interface LiveScreenFrame {
  dataUrl: string;
  name: string;
  capturedAt: number;
}

let active = false;
let frames: LiveScreenFrame[] = [];

function emit(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(LIVE_SCREEN_EVENT, {
      detail: { active, frames: [...frames] },
    }),
  );
}

export function isLiveScreenActive(): boolean {
  return active;
}

export function setLiveScreenActive(next: boolean): void {
  active = next;
  if (!active) frames = [];
  emit();
}

export function pushLiveScreenFrame(frame: LiveScreenFrame): void {
  if (!active) return;
  frames = [...frames, frame].slice(-2);
  emit();
}

export function getLiveScreenFrames(): LiveScreenFrame[] {
  return active ? [...frames] : [];
}

export function subscribeLiveScreen(
  listener: (state: { active: boolean; frames: LiveScreenFrame[] }) => void,
): () => void {
  if (typeof window === "undefined") return () => undefined;
  const handler = (event: Event) => {
    const detail = (event as CustomEvent<{ active: boolean; frames: LiveScreenFrame[] }>).detail;
    listener(detail ?? { active, frames: [...frames] });
  };
  window.addEventListener(LIVE_SCREEN_EVENT, handler);
  return () => window.removeEventListener(LIVE_SCREEN_EVENT, handler);
}
