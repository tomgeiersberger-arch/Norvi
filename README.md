# NORVI AI

**Your AI. Your hardware. Your data.**

NORVI is a local-first AI assistant for Windows, Linux and macOS. It combines local chat, image understanding, speech-to-text and a Windows desktop assistant with Ollama-backed models.

The default public setup is designed to keep ordinary AI requests, chat history, uploaded images and speech processing on the computer running NORVI. Internet access is required for the initial installation and model downloads; after that, normal local use can continue without an internet connection.

> NORVI is currently an early public preview. The Windows installer pipeline exists and is being hardened before the first tagged public release.

## Highlights

- Local AI through Ollama — no hosted AI API key required.
- Hardware-aware profiles: Lite 4B, Standard 8B and Power 14B.
- Local vision with Qwen3-VL.
- Local speech-to-text with Whisper.
- Windows desktop app with system tray support and autostart.
- Custom assistant name and custom wake phrase.
- Local spoken replies using installed Windows voices.
- Safe desktop actions through an explicit allowlist, currently Spotify and Counter-Strike 2.
- Local SQLite chat history and local image storage.
- Local-only guard that rejects cloud AI/STT/database endpoints when enabled.
- Telemetry disabled by default.

## Windows installer

Tagged releases are built into a normal NSIS installer named:

`NORVI-Setup-x.y.z.exe`

The desktop installer:

1. detects CPU, RAM and NVIDIA VRAM;
2. recommends Lite, Standard or Power;
3. installs missing local runtime dependencies;
4. downloads the selected Ollama and Whisper models;
5. creates a private local configuration;
6. initializes NORVI and launches the desktop app.

The installer creates normal Windows shortcuts and can keep NORVI running in the system tray.

Until a tagged installer release is published, NORVI can be installed from source using the steps below.

## Hardware profiles

| Profile | Typical hardware | Text model | Vision |
| --- | --- | --- | --- |
| Lite | smaller PCs / around 16 GB RAM | `qwen3:4b` | `qwen3-vl:2b` / `qwen3-vl:4b` |
| Standard | gaming PC / about 8 GB NVIDIA VRAM, or 24+ GB RAM with 8+ CPU threads | `qwen3:8b` | `qwen3-vl:4b` / `qwen3-vl:8b` |
| Power | high-end GPU / about 14+ GB NVIDIA VRAM | `qwen3:14b` | `qwen3-vl:8b` |

The automatic choice is a recommendation, not a hard requirement. Model speed depends heavily on GPU support, VRAM, system RAM, context size and quantization.

## Offline use

After the initial setup has downloaded NORVI, dependencies, Ollama models and the selected Whisper model, normal local features can work without internet:

- text chat;
- local chat history;
- local image analysis;
- local speech-to-text;
- Windows text-to-speech;
- local desktop actions.

Features that inherently need live internet data, external websites or online services still require a connection.

## Desktop assistant

On Windows, NORVI can stay in the tray and act like a local voice assistant.

Examples:

- `Hey NORVI`
- `Hey Dexter`
- `Öffne Spotify`
- `Starte CS2`

The assistant name and wake phrase are configurable. Wake audio is processed through NORVI's local Whisper endpoint.

Desktop actions are intentionally deny-by-default. The renderer and AI model do **not** receive a generic shell or terminal runner; only explicitly reviewed actions can be launched.

## Quick start from source

### Windows

Open PowerShell in the cloned or extracted NORVI folder:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\install-local.ps1
```

Force a profile when needed:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\install-local.ps1 --profile=standard
```

### Linux / macOS

```bash
chmod +x deploy/install-local.sh
./deploy/install-local.sh
```

Manual profile:

```bash
./deploy/install-local.sh --profile=standard
```

After setup:

```bash
bun run serve
```

Open `http://localhost:4200`.

## Privacy defaults

The generated public configuration enables:

```text
LOCAL_ONLY_MODE=true
NORVI_PUBLIC_EDITION=true
VITE_ENABLE_TELEMETRY=false
EXPO_PUBLIC_ENABLE_TELEMETRY=false
```

Local-only mode requires loopback AI/STT endpoints and a local `file:` SQLite database. The public edition hides private server-only Owner/Admin/Premium/Choke controls while keeping Fast, Standard, Power and Deep available.

See [docs/PRIVACY.md](docs/PRIVACY.md) for the exact local/external boundary.

## Self-hosting documentation

Detailed setup and desktop-assistant notes are in [docs/SELF_HOSTING.md](docs/SELF_HOSTING.md).

The repository intentionally does **not** contain multi-gigabyte model files. Models are downloaded directly on the user's machine.

## Development

Requirements:

- Bun
- Node-compatible build environment
- Ollama for local AI testing

Common commands:

```bash
bun install --frozen-lockfile
bun run typecheck
bun run lint
bun run build
```

Run the public-release safety check:

```bash
bash deploy/public-release-check.sh
```

## Security and secrets

Never commit:

- `.env`
- local databases
- files under `data/`
- API keys or tokens
- private keys
- personal server addresses or private deployment notes

The repository ignores normal local runtime data. CI also runs a public-release check to catch common accidental leaks before they reach a release.

## Current release direction

The next milestone is the first fully tested Windows installer release. Before that release, the project still needs a real clean-machine Windows end-to-end test of installation, model downloads, offline restart, wake-word mode, Spotify launch and CS2 launch.
