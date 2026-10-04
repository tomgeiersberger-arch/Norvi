# NORVI Privacy

NORVI is designed to run locally on hardware you control.

## Default self-hosted runtime

With the local installer and the generated configuration:

- AI inference runs through Ollama on `127.0.0.1:11434`.
- Chat data is stored in the local SQLite database under `data/`.
- Uploaded images stay in the local upload directory.
- Speech-to-text uses the local Whisper sidecar on `127.0.0.1`.
- No hosted AI API is required for local operation.
- Web and mobile telemetry are disabled by default (`VITE_ENABLE_TELEMETRY=false` and `EXPO_PUBLIC_ENABLE_TELEMETRY=false`).

## Network access

Internet access is needed during installation to download source dependencies and model files. After installation, ordinary AI requests can stay on the local machine.

NORVI can also be configured with hosted model providers, public tunnels, mobile clients or other external services. Those are optional and can send data outside the machine depending on how the owner configures them.

## Secrets and user data

Do not commit `.env`, `*.db`, `data/`, private keys or API tokens. The repository ignores these paths by default.

For a machine that should stay local-only, keep `WEBSITE_URL=http://localhost:4200` and do not enable a public tunnel.
