import { useEffect, useState } from "react";
import { useCapabilities } from "../queries/capabilities";
import { startRecording } from "../lib/recorder";
import { transcribeAudio } from "../lib/uploads";
import { getNorviDesktopAPI, isDesktop } from "../lib/desktop";
import {
  commandAfterWakePhrase,
  dispatchVoiceCommand,
  getAssistantSettings,
  subscribeAssistantSettings,
} from "../lib/desktop-assistant";

const WAKE_CHUNK_MS = 3600;
const COMMAND_CHUNK_MS = 6200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Background-only wake listener for the desktop app.
 *
 * The microphone audio is recorded locally and only voice-containing chunks are
 * sent to NORVI's own loopback Whisper endpoint. The wake phrase itself can be
 * changed freely because detection is based on local transcription rather than
 * a fixed cloud wake-word service.
 */
export function DesktopAssistantListener() {
  const capabilities = useCapabilities();
  const [settings, setSettings] = useState(getAssistantSettings);

  useEffect(() => subscribeAssistantSettings(setSettings), []);

  useEffect(() => {
    const api = getNorviDesktopAPI();
    if (!api) return;
    void api.setBackgroundMode(settings.wakeEnabled || settings.startWithWindows);
  }, [settings.startWithWindows, settings.wakeEnabled]);

  useEffect(() => {
    if (!isDesktop() || !settings.wakeEnabled || capabilities.data?.stt !== true) return;

    let cancelled = false;
    let activeHandle: Awaited<ReturnType<typeof startRecording>> | null = null;

    const recordFor = async (duration: number) => {
      activeHandle = await startRecording();
      await sleep(duration);
      if (cancelled) {
        activeHandle.cancel();
        activeHandle = null;
        return null;
      }
      const result = await activeHandle.stop();
      activeHandle = null;
      return result;
    };

    const listenForCommand = async () => {
      const api = getNorviDesktopAPI();
      if (!api || cancelled) return;
      if (settings.speakReplies) {
        await api.speak("Ja?", settings.voice || undefined).catch(() => undefined);
      }
      await sleep(180);
      const recording = await recordFor(COMMAND_CHUNK_MS);
      if (!recording?.voiceDetected || cancelled) return;
      const text = await transcribeAudio(recording.blob, "de", recording.filename);
      if (!cancelled) dispatchVoiceCommand(text);
    };

    const loop = async () => {
      while (!cancelled) {
        // While NORVI is in the foreground the normal microphone button owns
        // the input. Wake listening is meant for the background/tray use case.
        if (document.visibilityState === "visible" && document.hasFocus()) {
          await sleep(900);
          continue;
        }

        try {
          const recording = await recordFor(WAKE_CHUNK_MS);
          if (!recording?.voiceDetected || cancelled) {
            await sleep(180);
            continue;
          }

          const transcript = await transcribeAudio(recording.blob, "de", recording.filename);
          const command = commandAfterWakePhrase(transcript, settings.wakePhrase);
          if (command === null || cancelled) {
            await sleep(180);
            continue;
          }

          const api = getNorviDesktopAPI();
          await api?.showWindow();
          if (command) {
            dispatchVoiceCommand(command);
          } else {
            await listenForCommand();
          }

          // Avoid immediately hearing the tail of NORVI's own spoken response.
          await sleep(1200);
        } catch {
          if (!cancelled) await sleep(1400);
        }
      }
    };

    void loop();

    return () => {
      cancelled = true;
      activeHandle?.cancel();
      activeHandle = null;
    };
  }, [
    capabilities.data?.stt,
    settings.speakReplies,
    settings.voice,
    settings.wakeEnabled,
    settings.wakePhrase,
  ]);

  return null;
}
