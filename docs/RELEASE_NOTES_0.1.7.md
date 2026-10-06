# NORVI v0.1.7

NORVI v0.1.7 changes Windows runtime updates so stale file handles can no longer block the upgrade.

## Atomic runtime updates

- Installs every update into a new versioned runtime directory instead of deleting the currently active runtime in place.
- Preserves the previous local .env and data into the new runtime.
- Switches NORVI to the new runtime only after setup finishes successfully.
- Uses a small activation pointer written through a temporary file and rename.
- Leaves the previous runtime untouched during the update, so Windows can keep an old handle briefly without causing an EBUSY failure.
- Keeps the v0.1.6 scoped process cleanup as an extra safety layer.
- Existing local settings and user data remain preserved.

This specifically addresses repeated `EBUSY: resource busy or locked, rmdir ...\\Norvi AI\\runtime` failures seen on Windows.
