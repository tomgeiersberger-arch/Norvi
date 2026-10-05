# NORVI public release checklist

Use this before creating a public Windows release tag.

## Required automated checks

- [ ] `bash deploy/public-release-check.sh`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run build`
- [ ] Git working tree is clean

## Clean Windows machine test

- [ ] Download and run `NORVI-Setup-x.y.z.exe`
- [ ] Hardware detection selects a sensible profile
- [ ] Ollama installs/starts when missing
- [ ] Selected Qwen text and vision models download successfully
- [ ] Selected Whisper model is downloaded during setup
- [ ] NORVI starts without a terminal window
- [ ] Chat works
- [ ] Image analysis works
- [ ] Microphone transcription works
- [ ] Restart with internet disabled still supports local chat, vision and STT
- [ ] Custom assistant name works
- [ ] Custom wake phrase works
- [ ] Spoken replies work
- [ ] Spotify allowlisted launch works
- [ ] Counter-Strike 2 allowlisted launch works
- [ ] Disabling local app commands blocks those launches
- [ ] Closing the window to tray works
- [ ] Windows login autostart works
- [ ] First-run wizard completes without creating an online account
- [ ] Local default starts without a mandatory login
- [ ] Alt + Space focuses NORVI
- [ ] Configurable push-to-talk shortcut starts/stops local recording
- [ ] Screen Mode captures only after the user presses the Screen control
- [ ] Conversation Mode accepts a follow-up without another wake phrase
- [ ] Custom website call-word opens the configured http/https site
- [ ] User-selected custom program action launches only the selected local target
- [ ] Gaming Mode pauses background wake/conversation listening
- [ ] Model Manager can list/pull/activate curated models and protects the active model
- [ ] Settings backup exports/imports successfully
- [ ] Local Memory can be disabled, edited and cleared
- [ ] Text/code file drag-and-drop inserts local text without a cloud file upload
- [ ] Privacy Dashboard reflects local permissions and LOCAL_ONLY state
- [ ] Local diagnostics report exports without secrets or chat content
- [ ] Skills toggles map to Voice, Screen, Actions, Memory and Quick Access permissions
- [ ] Explorer “Mit NORVI öffnen” can be enabled/disabled and hands supported files to NORVI without executing them
- [ ] Update installer download is rejected if SHA-256 does not match SHA256SUMS.txt

## Privacy/security review

- [ ] No real `.env`, database, uploads, tokens or private keys are tracked
- [ ] No personal LAN/Tailscale addresses or machine-specific home paths are tracked
- [ ] `LOCAL_ONLY_MODE=true` blocks non-loopback AI/STT endpoints
- [ ] Public edition hides private server-only controls
- [ ] Desktop actions remain explicit allowlist entries; no generic shell runner is exposed

## Release metadata

- [ ] Desktop package version matches the Git tag
- [ ] Choose and add an explicit project license before calling the project open source
- [ ] Release notes explain model download size and that first setup requires internet
- [ ] Windows installer artifact is attached to the GitHub Release
- [ ] Pull-request Windows smoke build produced `NORVI-Setup-<version>.exe` and `SHA256SUMS.txt`


## Desktop assistant smoke checks

- Toggle Gaming Mode and verify background wake-word listening stops while manual chat, Alt + Space and push-to-talk still work.
- Verify the Windows workflow produces exactly `NORVI-Setup-<version>.exe` plus `SHA256SUMS.txt`.
- Compare the downloaded installer's SHA-256 against the published manifest before the clean-machine installation test.
