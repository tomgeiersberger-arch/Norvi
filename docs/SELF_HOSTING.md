# Self-host NORVI

NORVI can run completely on a local Windows, Linux or macOS computer. The public repository contains the application code, not the large AI model files. Models are downloaded directly by Ollama on the user's machine. Telemetry is disabled by default in the self-hosted configuration.

## Automatic hardware profiles

| Profile | Typical machine | Text model | Fast vision | Precise vision |
| --- | --- | --- | --- | --- |
| Lite | 16 GB RAM / no strong GPU | `qwen3:4b` | `qwen3-vl:2b` | `qwen3-vl:4b` |
| Standard | ~8 GB NVIDIA VRAM, or 24+ GB RAM with 8+ CPU threads | `qwen3:8b` | `qwen3-vl:4b` | `qwen3-vl:8b` |
| Power | ~14+ GB NVIDIA VRAM or high-memory Apple Silicon | `qwen3:14b` | `qwen3-vl:8b` | `qwen3-vl:8b` |

The installer detects system RAM, CPU threads and NVIDIA VRAM when available. GPU VRAM takes priority; CPU-only systems need both enough RAM and enough CPU threads before Standard is recommended. A profile can always be selected manually.

## Windows

The recommended path for normal users is a tagged GitHub Release containing **`NORVI-Setup-x.y.z.exe`**. The NSIS installer installs the NORVI desktop launcher. On first launch a graphical setup detects the hardware, lets the user choose Lite/Standard/Power, downloads the matching tagged NORVI source, installs Ollama/models locally, builds the web runtime and then opens NORVI.

For a cloned/extracted source tree, PowerShell remains available:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\install-local.ps1
```

Force a profile:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy\install-local.ps1 --profile=standard
```

## Linux / macOS

```bash
chmod +x deploy/install-local.sh
./deploy/install-local.sh
```

On macOS and Linux, the script uses Ollama's official install command when Ollama is not already installed.

Manual profile:

```bash
./deploy/install-local.sh --profile=standard
```

## Start NORVI

After setup:

```bash
bun run serve
```

Open `http://localhost:4200`. The first account becomes the local NORVI profile. Public Edition does not expose Owner/Admin/Premium/Choke controls. Additional registrations are closed by default after bootstrap.

## What the installer changes

The installer creates a local `.env` with random authentication/STT secrets, enables `LOCAL_ONLY_MODE=true` and `NORVI_PUBLIC_EDITION=true`, configures Ollama as the loopback AI endpoint, downloads the selected Qwen models, preloads the selected Whisper/ONNX speech model, creates lightweight NORVI model aliases, initializes SQLite and builds the web app.

Existing `.env` files are not overwritten unless `--force` is supplied.

## Privacy

The local profile does not require a hosted AI provider. See [PRIVACY.md](PRIVACY.md) for the exact local/external boundary.

## Desktop assistant (Windows)

The Windows desktop app can stay in the system tray and act as a local voice assistant.

In NORVI settings you can configure:

- a custom assistant name, such as NORVI, Dexter or Ultron;
- a custom wake phrase, such as Hey NORVI;
- local spoken replies using installed Windows voices;
- launch at Windows login and keep NORVI in the tray;
- local desktop app commands.

Wake audio is transcribed by NORVI's local Whisper service. The public local-only edition does not send microphone audio to a cloud speech service.

### Local app commands

NORVI can currently recognize commands such as:

- Öffne Spotify
- Starte CS2
- Mach Counter Strike 2 auf

Desktop actions use a fixed allowlist inside the Electron main process. The renderer and AI model do not receive a generic shell or terminal command runner. Current allowlisted program/game targets are Spotify and Counter-Strike 2 (Steam app 730).

The desktop settings let each user change the spoken call-words for those actions. For example, the CS2 action can use `cs2`, `counter strike` or another personal alias. Users can also add named website actions such as `Winkelhof → https://www.winkelhof.at` and then say `Starte winkelhof`. Custom website targets are validated and restricted to normal `http://` or `https://` URLs.


## Desktop assistant v2 controls

The Windows desktop settings also include:

- a microphone master permission for voice input and wake listening;
- opt-in Screen Mode, which captures the primary display only when the user presses the Screen button;
- Alt + Space quick access to bring NORVI forward and focus the prompt field;
- opt-in Conversation Mode with a configurable 8–30 second follow-up window.

These features stay local in the public local-only profile. Screen Mode uses Electron's desktop capture API and then sends the screenshot through NORVI's existing local image-analysis path.


## Login behavior

A normal public local install starts without an account screen. The local device ID scopes chats and local model/answer-style preferences.

For any installation that is reachable by other people or through a public reverse proxy, set `REQUIRE_AUTH=true`. That restores the account gate and disables anonymous chat/settings access.


## First-run desktop wizard

After the installer has detected the hardware and selected the 4B/8B/14B runtime profile, the desktop app finishes setup with a local wizard for the assistant name, wake phrase, Windows voice, microphone permission, Screen Mode and desktop actions. The wizard is only shown for the local public desktop profile and does not require an account.


## Desktop diagnostics and backup

The desktop settings include a local system overview for CPU, RAM, NVIDIA VRAM, hardware profile, active model, Vision and STT status. Users can export/import a JSON settings backup and can manually query the latest GitHub release. Update checking is not performed in the background.


## Custom programs and games

Windows users can add their own games/programs from Desktop Assistant settings. NORVI opens a native file picker and accepts an explicitly selected `.exe` or `.lnk`. The main process stores that path in its private local registry and returns only an opaque action id to the web UI. The user can then assign one or more call-words, for example `fn` for Fortnite.

Chat or model text can never supply an executable path, command line, arguments, or shell command. Launching is limited to the fixed built-ins plus ids that already exist in the native user-selected registry.


## Push-to-talk / voice shortcut

Desktop users can optionally register a global voice shortcut such as `CommandOrControl+Shift+Space`. One press starts the normal local microphone flow and the next press stops it. The accelerator is configurable in settings and can be disabled completely.


## Local Memory

The desktop app includes a small explicit memory manager. Users can keep up to 30 short local notes, edit/delete them individually, or disable memory entirely. Memory is not automatically extracted from chats. It is only forwarded to the model when the server is in `LOCAL_ONLY_MODE`.


## Model Manager and recovery

The Windows desktop settings expose curated Lite 4B, Standard 8B and Power 14B text profiles. A model can be pulled through the loopback Ollama API, activated by updating NORVI's local aliases, or deleted when it is not active.

The System & Maintenance card can also run a local self-test for runtime files, Bun, Ollama, NORVI's local web server and STT. The repair action can restart locally owned services where possible.
