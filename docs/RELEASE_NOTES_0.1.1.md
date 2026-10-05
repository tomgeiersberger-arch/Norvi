# NORVI v0.1.1

NORVI v0.1.1 is a Windows stability and security update.

## Fixed

- Fixes the packaged Windows black screen where the app could open as `@template/desktop` instead of loading the NORVI Setup UI.
- Packaged builds now use Electron's real packaged-state detection instead of relying on `NODE_ENV`.
- The Windows installer smoke test now requires a visible `NORVI Setup` window, so a running-but-black renderer no longer passes CI.

## Security

- Updates the desktop runtime to Electron 44.5.1 and electron-builder 26.15.3.
- Enables the Electron renderer sandbox.
- Removes unused unrestricted renderer file read/write IPC handlers.
- Blocks arbitrary renderer navigation and popups; normal HTTP/HTTPS links open through the system browser.
- Release publishing is tag-only and requires the Git tag to match the desktop version.

## Windows

Download `NORVI-Setup-0.1.1.exe` plus `SHA256SUMS.txt` from this release. The workflow verifies the installer, installs it silently on Windows, starts NORVI visibly and checks that the real Setup UI appears.

Existing v0.1.0 users can install v0.1.1 over the previous version.
