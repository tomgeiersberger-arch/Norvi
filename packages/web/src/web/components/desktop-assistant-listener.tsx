import { useEffect, useRef, useState } from "react";
import { useCapabilities } from "../queries/capabilities";
import { startRecording } from "../lib/recorder";
import { transcribeAudio } from "../lib/uploads";
import { getNorviDesktopAPI, isDesktop } from "../lib/desktop";
import {
  commandAfterWakePhrase,
  dispatchVoiceCommand,
  getAssistantSettings,
  subscribeAssistantSettings,
  VOICE_TURN_COMPLETE_EVENT,
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
  const conversationUntilRef = useRef(0);

  useEffect(() => subscribeAssistantSettings(setSettings), []);

  useEffect(() => {
    const api = getNorviDesktopAPI();
    if (!api) return;
    void api.setQuickShortcut(settings.quickShortcutEnabled);
  }, [settings.quickShortcutEnabled]);

  useEffect(() => {
    const onTurnComplete = () => {
      if (!settings.conversationMode || !settings.microphoneEnabled) {
        conversationUntilRef.current = 0;
        return;
      }
      conversationUntilRef.current =
        Date.now() + settings.conversationWindowSeconds * 1000;
    };
    window.addEventListener(VOICE_TURN_COMPLETE_EVENT, onTurnComplete);
    return () => window.removeEventListener(VOICE_TURN_COMPLETE_EVENT, onTurnComplete);
  }, [
    settings.conversationMode,
    settings.conversationWindowSeconds,
    settings.microphoneEnabled,
  ]);

  useEffect(() => {
    const api = getNorviDesktopAPI();
    if (!api) return;
    void api.setBackgroundMode(
      (settings.microphoneEnabled && settings.wakeEnabled) || settings.startWithWindows,
    );
  }, [settings.microphoneEnabled, settings.startWithWindows, settings.wakeEnabled]);

  useEffect(() => {
    if (
      !isDesktop() ||
      !settings.microphoneEnabled ||
      !settings.wakeEnabled ||
      capabilities.data?.stt !== true
    ) {
      return;
    }

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
        const conversationActive =
          settings.conversationMode && Date.now() < conversationUntilRef.current;

        // Outside conversation mode, the foreground composer owns the microphone.
        if (
          !conversationActive &&
          document.visibilityState === "visible" &&
          document.hasFocus()
        ) {
          await sleep(900);
          continue;
        }

        try {
          if (conversationActive) {
            const followUp = await recordFor(COMMAND_CHUNK_MS);
            if (!followUp?.voiceDetected || cancelled) {
              await sleep(180);
              continue;
            }
            const text = await transcribeAudio(followUp.blob, "de", followUp.filename);
            conversationUntilRef.current = 0;
            if (!cancelled && text.trim()) dispatchVoiceCommand(text);
            await sleep(500);
            continue;
          }

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
    settings.conversationMode,
    settings.microphoneEnabled,
    settings.speakReplies,
    settings.voice,
    settings.wakeEnabled,
    settings.wakePhrase,
  ]);

  return null;
}
