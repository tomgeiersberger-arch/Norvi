# NORVI v0.1.5

NORVI v0.1.5 is a Windows updater hotfix.

## Update reliability

- Fixes `EBUSY: resource busy or locked, rmdir ...\\Norvi AI\\runtime` when upgrading an existing installation.
- Stops NORVI's existing local Bun server/process tree before replacing the runtime.
- Waits for port 4200 to shut down before touching runtime files.
- Retries Windows `EBUSY`, `EPERM` and `ENOTEMPTY` file-lock failures instead of aborting immediately.
- The old NORVI desktop app now exits automatically after launching a verified update installer.
- Existing local settings and data are still preserved before the runtime is replaced.

The process cleanup is scoped to a listener whose command line matches NORVI's local `packages/web/src/__server.ts` server.
