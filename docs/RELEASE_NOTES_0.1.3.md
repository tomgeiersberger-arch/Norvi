# NORVI v0.1.3

NORVI v0.1.3 is a local voice reliability update for Windows.

## Speech-to-text

- Fixes the bundled local Whisper sidecar on Windows by using native filesystem paths.
- Existing installs are migrated back to the local loopback STT service instead of depending on an old home-server address.
- Empty local STT API keys are repaired automatically so the sidecar can start.
- Speech-to-text remains local to the Windows PC.

## Runtime updates

- NORVI now records the installed local runtime version.
- After a desktop app update, an older local runtime is refreshed automatically before NORVI opens.
- Existing local data and the .env configuration are preserved during the runtime refresh.

## Reliability

- Keeps the self-test checks for Bun, Ollama, NORVI Server and Speech-to-Text.
- v0.1.3 must pass the normal CI and Windows installer smoke tests before release.
