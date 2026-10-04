# NORVI Windows installer

NORVI's Windows release is a normal graphical desktop installer built with Electron Builder + NSIS.

## User flow

1. Download `NORVI-Setup-x.y.z.exe` from GitHub Releases.
2. Install NORVI and launch it from the Desktop or Start menu.
3. The first-run setup detects CPU, RAM and NVIDIA VRAM.
4. NORVI recommends Lite 4B, Standard 8B or Power 14B; the user can override it.
5. The setup downloads the source for the exact release tag, installs Bun/Ollama when needed, downloads the selected local models, creates the local SQLite configuration and builds NORVI.
6. NORVI starts its local server automatically and opens the desktop window.

After the first setup, normal local inference does not need an Internet connection. Internet-only features naturally remain unavailable while offline.

## Build locally

From the repository root on Windows:

```powershell
bun install --frozen-lockfile
bun run dist:windows
```

The resulting installer is written below `packages/desktop/release/`.

## GitHub releases

`.github/workflows/windows-release.yml` builds the installer on Windows for `v*` tags and attaches the generated EXE to the matching GitHub Release.

The Git tag must match the desktop package version. Example: `packages/desktop/package.json` version `0.1.0` is released as tag `v0.1.0`. The first-run installer intentionally downloads the matching immutable tag instead of an arbitrary moving branch.

## Local data

The desktop launcher keeps the runtime under Electron's per-user NORVI data directory. A reinstall preserves the existing `.env` and `data/` directory before refreshing application source files. Uninstalling the desktop shell does not automatically delete local user data.
