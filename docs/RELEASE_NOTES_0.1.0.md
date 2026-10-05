# NORVI v0.1.0

NORVI v0.1.0 is the first Windows release of the local desktop assistant.

## Before you install

- The first setup requires an Internet connection.
- NORVI downloads the release runtime plus the selected local AI, vision and speech-to-text models.
- Model downloads are several GB and depend on the selected Lite, Standard or Power profile. Standard and Power can require well over 10 GB of additional download and storage.
- Keep enough free disk space for the installer, runtime, models and future updates.

## What is included

- Login-free local first-run setup
- Automatic hardware profile recommendation with manual override
- Local chat, vision and speech-to-text
- Fast, Standard, Power and Deep response modes
- Local Memory with user controls
- Model Manager and runtime recovery tools
- Gaming Mode
- Configurable push-to-talk and Alt + Space quick access
- Screen Mode and Conversation Mode
- Allowlisted program, website and system actions
- Settings backup/import, diagnostics and privacy dashboard
- Verified update downloads with SHA-256 checks

## Offline use

After the first setup and model downloads finish, the local chat, vision and speech-to-text stack can run offline. Features that inherently require Internet access, such as checking for new GitHub releases, remain unavailable while offline.

## Windows installer

Download `NORVI-Setup-0.1.0.exe` and `SHA256SUMS.txt` from the GitHub Release. The release workflow verifies the installer artifact, performs a silent install/start smoke test on Windows, and publishes the matching SHA-256 checksum.