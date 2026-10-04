#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

python3 - <<'PY'
from __future__ import annotations

import pathlib
import re
import subprocess
import sys

root = pathlib.Path.cwd()
tracked = subprocess.check_output(["git", "ls-files", "-z"]).decode().split("\0")
tracked = [p for p in tracked if p]

errors: list[str] = []

for forbidden in ("task.md",):
    if forbidden in tracked:
        errors.append(f"{forbidden}: internal project notes must not be tracked in the public repository")

credential_patterns = [
    re.compile(r"github_pat_[A-Za-z0-9_]{16,}"),
    re.compile(r"ghp_[A-Za-z0-9]{20,}"),
    re.compile(r"sk-[A-Za-z0-9_-]{16,}"),
    re.compile(r"AIza[0-9A-Za-z_-]{20,}"),
    re.compile(r"-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----"),
]

private_ip = re.compile(
    r"(?<![0-9])(?:"
    r"10(?:\.[0-9]{1,3}){3}|"
    r"192\.168(?:\.[0-9]{1,3}){2}|"
    r"172\.(?:1[6-9]|2[0-9]|3[01])(?:\.[0-9]{1,3}){2}|"
    r"100\.(?:6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])(?:\.[0-9]{1,3}){2}"
    r")(?![0-9])"
)
absolute_home = re.compile(r"/home/[A-Za-z0-9._-]+/")
temp_tunnel = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com", re.I)

secret_assignment = re.compile(
    r"^\s*(?:export\s+)?"
    r"(BETTER_AUTH_SECRET|AI_API_KEY|AI_GATEWAY_API_KEY|STT_API_KEY|"
    r"CLOUDFLARE_TUNNEL_TOKEN|TAILSCALE_AUTHKEY)\s*=\s*(.+?)\s*$"
)
placeholder = re.compile(
    r"^(?:|<[^>]+>|\$\{[^}]+\}|\$[A-Za-z_][A-Za-z0-9_]*|"
    r"changeme|change-me|replace-me|example|dummy|none|null)$",
    re.I,
)

for rel in tracked:
    path = root / rel
    try:
        data = path.read_bytes()
    except OSError:
        continue
    if b"\0" in data:
        continue
    text = data.decode("utf-8", errors="ignore")

    for number, line in enumerate(text.splitlines(), 1):
        if any(pattern.search(line) for pattern in credential_patterns):
            errors.append(f"{rel}:{number}: looks like a credential/private key")
        if private_ip.search(line):
            errors.append(f"{rel}:{number}: contains a literal private/CGNAT IP address")
        if absolute_home.search(line):
            errors.append(f"{rel}:{number}: contains a user-specific absolute /home path")
        if temp_tunnel.search(line):
            errors.append(f"{rel}:{number}: contains a concrete temporary tunnel URL")

        match = secret_assignment.match(line)
        if match:
            value = match.group(2).strip().strip("\"'")
            if not placeholder.fullmatch(value):
                errors.append(f"{rel}:{number}: {match.group(1)} has a non-placeholder value")

if errors:
    print("NORVI public-release check: FAILED", file=sys.stderr)
    for error in errors:
        print(" -", error, file=sys.stderr)
    sys.exit(1)

print("NORVI public-release check: OK")
PY
