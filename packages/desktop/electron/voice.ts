import { execFileSync, spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

let speechProcess: ChildProcessWithoutNullStreams | null = null;

function b64(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

export function listLocalVoices(): string[] {
  if (process.platform !== "win32") return [];

  const runVoiceList = (script: string): string[] => {
    const raw = execFileSync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      { encoding: "utf8", windowsHide: true, timeout: 15_000 },
    ).trim();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string | string[];
    return Array.isArray(parsed) ? parsed : [parsed];
  };

  const systemSpeechScript = [
    "Add-Type -AssemblyName System.Speech",
    "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "$names = @($s.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name })",
    "$names | ConvertTo-Json -Compress",
  ].join("; ");

  try {
    const voices = runVoiceList(systemSpeechScript);
    if (voices.length) return voices;
  } catch {
    // Fall through to SAPI below.
  }

  const sapiScript = [
    "$s = New-Object -ComObject SAPI.SpVoice",
    "$names = @($s.GetVoices() | ForEach-Object { $_.GetDescription() })",
    "$names | ConvertTo-Json -Compress",
  ].join("; ");

  try {
    return runVoiceList(sapiScript);
  } catch {
    return [];
  }
}

export function stopSpeech(): void {
  if (!speechProcess || speechProcess.killed) return;
  speechProcess.kill();
  speechProcess = null;
}

async function runSpeechPowerShell(
  script: string,
  text: string,
  voice: string,
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script],
      {
        windowsHide: true,
        env: {
          ...process.env,
          NORVI_TTS_TEXT: b64(text),
          NORVI_TTS_VOICE: b64(voice),
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

export async function speakLocal(text: string, voice?: string): Promise<void> {
  const clean = text.replace(/\s+/g, " ").trim().slice(0, 6000);
  if (!clean) return;
  if (process.platform !== "win32") {
    throw new Error("Lokale Sprachausgabe ist aktuell in der Windows-App verfügbar.");
  }

  stopSpeech();
  const selectedVoice = voice?.trim() ?? "";
  const systemSpeechScript = [
    "Add-Type -AssemblyName System.Speech",
    "$t=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:NORVI_TTS_TEXT))",
    "$v=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:NORVI_TTS_VOICE))",
    "$s=New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "if($v){try{$s.SelectVoice($v)}catch{}}",
    "$s.SetOutputToDefaultAudioDevice()",
    "$s.Speak($t)",
  ].join("; ");

  try {
    await runSpeechPowerShell(systemSpeechScript, clean, selectedVoice);
    return;
  } catch {
    // Some Windows installations expose voices through SAPI even when the
    // .NET System.Speech path fails. Keep the preview/local TTS usable there.
  }

  const sapiScript = [
    "$t=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:NORVI_TTS_TEXT))",
    "$v=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:NORVI_TTS_VOICE))",
    "$s=New-Object -ComObject SAPI.SpVoice",
    "if($v){$m=@($s.GetVoices()|Where-Object{$_.GetDescription() -eq $v})[0];if($m){$s.Voice=$m}}",
    "$null=$s.Speak($t)",
  ].join("; ");

  await runSpeechPowerShell(sapiScript, clean, selectedVoice);
}
