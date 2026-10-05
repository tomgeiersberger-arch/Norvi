import dedent from "dedent";

export interface AgentRuntimeCapabilities {
  localOnly: boolean;
  vision: boolean;
  stt: boolean;
  desktop: boolean;
  screenCapture: boolean;
  desktopActions: boolean;
}

/**
 * Ground the model in what this exact NORVI installation can do.
 *
 * Keep this factual and capability-based: the language model should explain
 * available app features, but must never pretend it executed a desktop action
 * unless the desktop action layer actually handled that command.
 */
export function capabilityInstruction(capabilities: AgentRuntimeCapabilities): string {
  const local = capabilities.localOnly
    ? "Local/offline chat: available. Normal AI chat can run on this PC without a cloud AI service after setup."
    : "Local/offline chat: not guaranteed by this installation.";
  const vision = capabilities.vision
    ? "Images: available. You can analyse an image when the user attaches one."
    : "Images: not available in the current runtime. Do not claim that you can see or analyse an unattached image.";
  const stt = capabilities.stt
    ? "Speech-to-text: available through NORVI's microphone controls; transcribed speech is sent to chat as user text."
    : "Speech-to-text: not available in the current runtime.";
  const desktop = capabilities.desktop
    ? "Desktop app: active. NORVI is running inside the Windows desktop app."
    : "Desktop app: not confirmed for this client.";
  const screen = capabilities.screenCapture
    ? "Screen explanation: available. Live Screen keeps the latest screen states locally and attaches the newest frames to the user's next request; one-off screenshot analysis is also available."
    : "Screen explanation: not available for this client.";
  const actions = capabilities.desktopActions
    ? "Desktop actions: enabled. The separate desktop action layer can open configured/allowlisted programs or games and configured HTTP/HTTPS websites when a matching call word is used. Do not claim an action happened unless that layer actually handled it."
    : "Desktop actions: not enabled for this client. Do not claim that you opened programs, games, websites or changed the PC.";

  return dedent`
    NORVI runtime capabilities for this request:
    - ${local}
    - ${vision}
    - ${stt}
    - ${desktop}
    - ${screen}
    - ${actions}

    If the user asks "was kannst du?", "what can you do?" or an obvious typo/equivalent,
    answer concretely from the capabilities above instead of giving generic support-bot
    filler such as "Wobei brauchst du Hilfe?". Mention unavailable features only when
    relevant. Do not claim capabilities that are not listed as available, and do not
    pretend to browse the web, execute arbitrary shell commands, control the PC, see
    the screen, hear audio or open something unless the corresponding NORVI feature
    is actually available and has supplied/handled the required input.
  `;
}
