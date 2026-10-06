import { useEffect, useRef, useState } from "react";
import { useCapabilities } from "../queries/capabilities";
import { startRecording } from "../lib/recorder";
import { transcribeAudio } from "../lib/uploads";
import { getNorviDesktopAPI, isDesktop } from "../lib/desktop";
import {
  commandAfterWakePhrase,
  dispatchVoiceCommand,
  dispatchVoiceStatus,
  FOREGROUND_MICROPHONE_EVENT,
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
  const foregroundMicRef = useRef(false);

  useEffect(() => subscribeAssistantSettings(setSettings), []);

  useEffect(() => {
    const onForegroundMic = (event: Event) => {
      foregroundMicRef.current =
        (event as CustomEvent<{ active?: boolean }>).detail?.active === true;
    };
    window.addEventListener(FOREGROUND_MICROPHONE_EVENT, onForegroundMic);
    return () => window.removeEventListener(FOREGROUND_MICROPHONE_EVENT, onForegroundMic);
  }, []);

  useEffect(() => {
    const api = getNorviDesktopAPI();
    if (!api) return;
    void api.setQuickShortcut(settings.quickShortcutEnabled);
  }, [settings.quickShortcutEnabled]);

  useEffect(() => {
    const onTurnComplete = () => {
      if (
        settings.gamingMode ||
        !settings.conversationMode ||
        !settings.microphoneEnabled
      ) {
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
    settings.gamingMode,
    settings.microphoneEnabled,
  ]);

  useEffect(() => {
    const api = getNorviDesktopAPI();
    if (!api) return;
    void api.setBackgroundMode(
      (!settings.gamingMode && settings.microphoneEnabled && settings.wakeEnabled) ||
        settings.startWithWindows,
    );
  }, [
    settings.gamingMode,
    settings.microphoneEnabled,
    settings.startWithWindows,
    settings.wakeEnabled,
  ]);

  useEffect(() => {
    if (
      !isDesktop() ||
      settings.gamingMode ||
      !settings.microphoneEnabled ||
      !settings.wakeEnabled ||
      capabilities.data?.stt !== true
    ) {
      dispatchVoiceStatus("off");
      return;
    }

    dispatchVoiceStatus("ready");
    let cancelled = false;
    let activeHandle: Awaited<ReturnType<typeof startRecording>> | null = null;

    const recordFor = async (duration: number) => {
      activeHandle = await startRecording(settings.microphoneDeviceId || undefined);
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
      dispatchVoiceStatus("listening");
      const recording = await recordFor(COMMAND_CHUNK_MS);
      if (!recording?.voiceDetected || cancelled) {
        if (!cancelled) dispatchVoiceStatus("ready");
        return;
      }
      dispatchVoiceStatus("processing");
      const text = await transcribeAudio(recording.blob, "de", recording.filename);
      if (!cancelled && text.trim()) {
        dispatchVoiceStatus("command");
        dispatchVoiceCommand(text);
        await sleep(650);
      }
      if (!cancelled) dispatchVoiceStatus("ready");
    };

    const loop = async () => {
      let wakeTranscriptTail = "";
      while (!cancelled) {
        const conversationActive =
          settings.conversationMode && Date.now() < conversationUntilRef.current;

        // A manual push-to-talk recording temporarily owns the selected microphone.
        if (foregroundMicRef.current) {
          wakeTranscriptTail = "";
          await sleep(250);
          continue;
        }

        try {
          if (conversationActive) {
            dispatchVoiceStatus("listening");
            const followUp = await recordFor(COMMAND_CHUNK_MS);
            if (!followUp?.voiceDetected || cancelled) {
              if (!cancelled) dispatchVoiceStatus("ready");
              await sleep(180);
              continue;
            }
            dispatchVoiceStatus("processing");
            const text = await transcribeAudio(followUp.blob, "de", followUp.filename);
            conversationUntilRef.current = 0;
            if (!cancelled && text.trim()) {
              dispatchVoiceStatus("command");
              dispatchVoiceCommand(text);
              await sleep(650);
            }
            if (!cancelled) dispatchVoiceStatus("ready");
            await sleep(500);
            continue;
          }

          const recording = await recordFor(WAKE_CHUNK_MS);
          if (!recording?.voiceDetected || cancelled) {
            await sleep(180);
            continue;
          }

          const transcript = await transcribeAudio(recording.blob, "de", recording.filename);
          const combinedTranscript = (wakeTranscriptTail + " " + transcript).trim();
          const command = commandAfterWakePhrase(combinedTranscript, settings.wakePhrase);
          wakeTranscriptTail = transcript.split(/\s+/).slice(-5).join(" ");
          if (command === null || cancelled) {
            await sleep(180);
            continue;
          }
          wakeTranscriptTail = "";

          const api = getNorviDesktopAPI();
          await api?.showWindow();
          if (command) {
            dispatchVoiceStatus("command");
            dispatchVoiceCommand(command);
            await sleep(650);
            if (!cancelled) dispatchVoiceStatus("ready");
          } else {
            await listenForCommand();
          }

          // Avoid immediately hearing the tail of NORVI's own spoken response.
          await sleep(1200);
        } catch {
          if (!cancelled) {
            dispatchVoiceStatus("ready");
            await sleep(1400);
          }
        }
      }
    };

    void loop();

    return () => {
      cancelled = true;
      activeHandle?.cancel();
      activeHandle = null;
      dispatchVoiceStatus("off");
    };
  }, [
    capabilities.data?.stt,
    settings.conversationMode,
    settings.gamingMode,
    settings.microphoneEnabled,
    settings.microphoneDeviceId,
    settings.speakReplies,
    settings.voice,
    settings.wakeEnabled,
    settings.wakePhrase,
  ]);

  return null;
}
