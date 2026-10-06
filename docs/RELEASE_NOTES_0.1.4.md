# NORVI v0.1.4

NORVI v0.1.4 focuses on voice reliability, clearer assistant feedback and safer desktop maintenance.

## Speech-to-text

- Prevents runaway repeated transcripts such as short words being duplicated dozens of times.
- Migrates older `tiny` Whisper defaults to the detected hardware profile when the PC can use a more accurate model.
- Uses `base` as the safer fallback for new local STT setups.
- Keeps speech-to-text local.

## Voice assistant

- Adds visible states for `Bereit`, `Höre zu…`, `Verarbeite…` and `Befehl erkannt`.
- Removes the redundant top-right microphone availability icon.
- Adds a Windows SAPI fallback for local voice preview and surfaces preview errors instead of failing silently.

## Desktop actions

- Adds a selectable folder scan for games and programs in addition to Start menu, Desktop and Steam discovery.
- Keeps discovered programs opt-in before NORVI is allowed to launch them.

## Diagnostics

- Fixes diagnostic report saving by performing the write in Electron's main process through a bounded text-save IPC path.
- Keeps diagnostic reports free of API keys and chat contents.

## Reliability

- Adds regression checks for the v0.1.4 voice, diagnostics and folder-scan fixes.
- v0.1.4 must pass normal CI and the Windows installer smoke test before release.
