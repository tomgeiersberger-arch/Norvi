# NORVI v0.1.2

NORVI v0.1.2 is a Windows assistant and interaction update.

## Smarter local chat

- NORVI now knows which capabilities are actually available on the current installation instead of answering generic capability questions.
- Fixes local Qwen/Ollama reasoning control so Fast/Standard/Power do not waste the answer budget on hidden thinking.
- Questions such as "Was kannst du?" now receive a concrete answer based on the active NORVI features.

## Voice

- Adds microphone device selection with a System Default option.
- Adds a voice preview button for installed Windows voices, including the first-start wizard.
- Fixes Wakeword listening while the NORVI window is open and focused.
- Wakeword detection now keeps a short transcript overlap so "Hey NORVI" is less likely to be lost between recording chunks.
- Manual push-to-talk temporarily pauses the background Wakeword listener.
- Speech-to-text now self-repairs missing local STT settings on existing installs, stays available while the local Whisper sidecar starts, and places the microphone button directly next to Send.

## Programs and call words

- Built-in call-word targets are now Spotify, Steam, Discord and Browser.
- Removes Counter-Strike 2, Downloads and Explorer from the built-in call-word list.
- Adds "PC scannen": NORVI can discover Start Menu programs, desktop shortcuts and installed Steam games.
- Scanned apps are only launchable after the user explicitly selects and adds them.
- Custom websites remain unchanged.

## Live Screen

- Removes the duplicate Screen button next to File/Image.
- "Screen erklären" is now a Live Screen mode.
- While enabled, NORVI locally keeps the two newest screen states and attaches them to the next text or voice request so it can compare recent screen changes.
- The existing one-shot error screenshot action remains available.

## UI and reliability

- Removes the unused eye indicator from the top bar.
- Keeps the v0.1.1 packaged-startup and visible-UI Windows smoke tests.
- Full regression, typecheck, lint and production-build coverage is required before release.
