# NORVI v0.1.6

NORVI v0.1.6 fixes a Windows runtime-lock edge case during upgrades.

## Update reliability

- Fixes a remaining `EBUSY: resource busy or locked, rmdir ...\\Norvi AI\\runtime` failure.
- Captures NORVI's managed Bun PID before the desktop runtime clears it.
- Terminates the full managed NORVI process tree on Windows.
- Sweeps lingering NORVI runtime children, including local Whisper/STT, when their command line still points into the NORVI runtime directory.
- Keeps the cleanup scoped to NORVI runtime processes instead of terminating unrelated Bun, Node or Python applications.
- Preserves existing local settings and data before replacing the runtime.
- Keeps SHA-256 verification for downloaded NORVI updates.
