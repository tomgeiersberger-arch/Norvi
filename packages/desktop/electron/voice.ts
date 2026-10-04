import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

let speechProcess: ChildProcessWithoutNullStreams | null = null;

function b64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

export function listLocalVoices(): string[] {
  if (process.platform !== "win32") return [];
  const script = [
    "Add-Type -AssemblyName System.Speech",
    "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "$names = @($s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name })",
    "$names | ConvertTo-Json -Compress",
  ].join("; ");

  try {
    const raw = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { encoding: "utf8", windowsHide: true, timeout: 15_000 },
    ).trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string | string[];
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

export function stopSpeech(): void {
  if (!speechProcess || speechProcess.killed) return;
  speechProcess.kill();
  speechProcess = null;
}

export async function speakLocal(text: string, voice?: string): Promise<void> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 6000);
  if (!clean) return;
  if (process.platform !== "win32") {
    throw new Error("Lokale Sprachausgabe ist aktuell in der Windows-App verfügbar.");
  }

  stopSpeech();
  const script = [
    "Add-Type -AssemblyName System.Speech",
    "$t=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:NORVI_TTS_TEXT))",
    "$v=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:NORVI_TTS_VOICE))",
    "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "if($v){try{$s.SelectVoice($v)}catch{}}",
    "$s.SetOutputToDefaultAudioDevice()",
    "$s.Speak($t)",
  ].join("; ");

  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        windowsHide: true,
        env: {
          ...process.env,
          NORVI_TTS_TEXT: b64(clean),
          NORVI_TTS_VOICE: b64(voice?.trim() ?? ""),
        },
      },
    );
    speechProcess = child;
    child.once("error", (error) => {
      if (speechProcess === child) speechProcess = null;
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (speechProcess === child) speechProcess = null;
      if (signal || code === 0) resolve();
      else reject(new Error(`Lokale Sprachausgabe wurde mit Code ${code ?? "?"} beendet.`));
    });
  });
}
