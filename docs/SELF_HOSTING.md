# Self-host NORVI

NORVI can run completely on a local Windows, Linux or macOS computer. The public repository contains the application code, not the large AI model files. Models are downloaded directly by Ollama on the user's machine. Telemetry is disabled by default in the self-hosted configuration.

## Automatic hardware profiles

| Profile | Typical machine | Text model | Fast vision | Precise vision |
| --- | --- | --- | --- | --- |
| Lite | 16 GB RAM / no strong GPU | `qwen3:4b` | `qwen3-vl:2b` | `qwen3-vl:4b` |
| Standard | 24+ GB RAM or ~8 GB NVIDIA VRAM | `qwen3:8b` | `qwen3-vl:4b` | `qwen3-vl:8b` |
| Power | ~14+ GB NVIDIA VRAM or high-memory Apple Silicon | `qwen3:14b` | `qwen3-vl:8b` | `qwen3-vl:8b` |

The installer detects system RAM, CPU threads and NVIDIA VRAM when available. A profile can always be selected manually.

## Windows

Open PowerShell in the cloned/extracted NORVI folder:

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

On macOS, the installer uses Homebrew for Ollama when Ollama is not already installed.

Manual profile:

```bash
./deploy/install-local.sh --profile=standard
```

## Start NORVI

After setup:

```bash
bun run serve
```

Open `http://localhost:4200`. The first account becomes Owner. Additional registrations are closed by default after bootstrap.

## What the installer changes

The installer creates a local `.env` with random authentication/STT secrets, configures Ollama as the local AI endpoint, downloads the selected Qwen models, creates lightweight NORVI model aliases, initializes SQLite and builds the web app.

Existing `.env` files are not overwritten unless `--force` is supplied.

## Privacy

The local profile does not require a hosted AI provider. See [PRIVACY.md](PRIVACY.md) for the exact local/external boundary.
