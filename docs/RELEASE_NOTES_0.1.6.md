# NORVI v0.1.6

NORVI v0.1.6 fixes the remaining Windows runtime-lock update failure.

## Windows runtime updates

- Installs each NORVI desktop version into its own local runtime directory.
- Migrates the existing local `.env`, database and uploads into the new versioned runtime.
- Leaves the previous runtime untouched during the upgrade, so a stale Windows file handle can no longer block installation.
- Cleans up stale NORVI Bun/Node/Python processes tied to the old runtime, including local Whisper/STT processes.
- Keeps the existing verified update-download and SHA-256 validation flow.

This specifically fixes the persistent `EBUSY: resource busy or locked, rmdir ...\\Norvi AI\\runtime` failure that could still occur in v0.1.5.
