# NORVI v0.1.5

NORVI v0.1.5 is a Windows update hotfix for locked local runtime files.

## Windows updater

- Stops the local NORVI server before launching a newer installer.
- Detects stale NORVI/Whisper listeners on the local runtime ports and terminates only matching NORVI processes.
- Retries removal of the local runtime when Windows reports EBUSY, EPERM or ENOTEMPTY.
- Shows a clearer error only after all safe retries fail.

This fixes the update failure where Windows reported that `AppData\\Roaming\\Norvi AI\\runtime` was busy or locked.
