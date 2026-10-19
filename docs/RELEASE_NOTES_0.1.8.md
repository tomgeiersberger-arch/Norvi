# NORVI v0.1.8

## Windows update reliability

- Verify the new local services before accepting a runtime upgrade.
- Automatically reactivate the previous runtime if installation or verification fails.
- Preserve existing local settings and data.
- Avoid immediate repeated update attempts after a failed upgrade.
- Add regression tests for rollback and retry behavior.

This version remains in development until all CI and Windows smoke tests pass.
