type AiKind = "text" | "vision";

interface AiSample {
  at: number;
  kind: AiKind;
  durationMs: number;
  ok: boolean;
}

const samples: AiSample[] = [];
const MAX_SAMPLES = 200;

export function recordAiRequest(kind: AiKind, durationMs: number, ok: boolean): void {
  samples.push({
    at: Date.now(),
    kind,
    durationMs: Math.max(0, Math.round(durationMs)),
    ok,
  });
  if (samples.length > MAX_SAMPLES) {
    samples.splice(0, samples.length - MAX_SAMPLES);
  }
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function p95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? null;
}

/** Aggregate-only runtime diagnostics; no prompts, user ids or message text are retained. */
export function aiMetricsSnapshot() {
  const successful = samples.filter((sample) => sample.ok);
  const durations = successful.map((sample) => sample.durationMs);
  const textDurations = successful
    .filter((sample) => sample.kind === "text")
    .map((sample) => sample.durationMs);
  const visionDurations = successful
    .filter((sample) => sample.kind === "vision")
    .map((sample) => sample.durationMs);

  return {
    samples: samples.length,
    errors: samples.filter((sample) => !sample.ok).length,
    averageMs: average(durations),
    p95Ms: p95(durations),
    textAverageMs: average(textDurations),
    visionAverageMs: average(visionDurations),
  };
}
