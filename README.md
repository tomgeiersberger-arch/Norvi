# App template

Runable copies this Bun and Turborepo project into each new sandbox.

The root package commands are the external contract:

- `bun run dev` starts the web app.
- `bun run dev:desktop` and `bun run dev:mobile` start platform clients.
- `bun run build` builds every package.
- `bun run start` starts or restarts the production server.
- `bun run stop` stops the production server.
- `bun run lint` and `bun run typecheck` validate the project.
- The `db:generate`, `db:migrate`, and `db:push` commands manage the database.

Deployment tools depend on these command names. Their implementations may change, but the names must remain stable.

The web package owns the API, database, and shared web interface. The mobile package is an Expo client. The desktop package is an Electron shell around the web app. Services use the fixed ports defined in `__ports.cjs`, and the web health endpoint is `/api/health`.

Secrets belong in the root `.env` file. Browser values must use the `VITE_` prefix. Commands prefixed with `internal:` are for template maintenance.

---

# NORVI AI — Mobile App über Expo Go im Heimnetz

Die mobile NORVI-App läuft in **Expo Go** direkt auf dem Smartphone. Damit der QR-Code
nicht auf `localhost` oder eine nicht erreichbare Cloud-Adresse zeigt, ist **LAN die
Standard-Verbindung**.

## 1. Voraussetzungen

- Ubuntu-Server und Smartphone hängen im **selben WLAN / LAN** (kein Gäste-WLAN, keine
  Client-Isolation im Router).
- **Expo Go** aus dem Play Store bzw. App Store installiert (SDK 54 kompatibel).
- Bun installiert, Abhängigkeiten via `bun install` im Projekt-Root.

## 2. Ports in der Firewall öffnen

```bash
ip addr show | grep "inet "        # LAN-IP des Servers ermitteln, z. B. 192.168.1.42
sudo ufw allow 4200/tcp            # NORVI Web + API
sudo ufw allow 4300/tcp            # Expo Dev-Server (Metro / Expo Go)
sudo ufw reload
```

## 3. Wichtig beim Selbst-Hosten: Proxy-Variable leeren

`packages/mobile/.env` enthält in der Runable-Sandbox `EXPO_PACKAGER_PROXY_URL` mit einer
Cloud-Adresse. Zeigt der QR-Code auf eine nicht erreichbare URL, ist **genau das** die
Ursache. Auf dem eigenen Server muss die Zeile leer sein:

```bash
echo "EXPO_PACKAGER_PROXY_URL=" > packages/mobile/.env
```

Optional die LAN-IP fest verdrahten (nützlich bei mehreren Netzwerk-Interfaces, VPN oder Docker-Bridges):

```bash
export REACT_NATIVE_PACKAGER_HOSTNAME=192.168.1.42
```

## 4. Starten

```bash
# Terminal 1 — Web + API (liefert Chats, Verlauf und KI-Antworten)
bun run dev
# oder produktiv: bun run build:web && bun run start

# Terminal 2 — Expo Dev-Server, LAN ist Standard
bun run dev:mobile
```

Im Terminal erscheint der QR-Code plus eine URL der Form `exp://192.168.1.42:4300`.

- **Android:** QR-Code direkt in Expo Go scannen.
- **iOS:** QR-Code mit der Kamera-App scannen, dann „In Expo Go öffnen“.
- Alternativ die `exp://`-URL in Expo Go unter „Enter URL manually“ eintippen.

Weitere Startvarianten:

| Befehl | Verbindung | Einsatz |
| --- | --- | --- |
| `bun run dev:mobile` | **LAN (Standard)** | Smartphone im selben WLAN |
| `bun run dev:mobile:tunnel` | Tunnel über Expo | anderes Netz, Mobilfunk, restriktive Firewall |
| `bun run dev:mobile:localhost` | localhost | nur Emulator/Simulator auf dem Server selbst |

## 5. API-Adresse der mobilen App

Die App ermittelt die NORVI-API automatisch in dieser Reihenfolge
(`packages/mobile/lib/api-base.ts`):

1. `EXPO_PUBLIC_API_URL` — expliziter Override, gewinnt immer (z. B. hinter nginx:
   `EXPO_PUBLIC_API_URL=http://192.168.1.42` oder `https://norvi.example.com`).
2. **LAN-Erkennung:** wurde der Dev-Server von einer privaten IP geladen
   (`10.x`, `192.168.x`, `172.16–31.x`), spricht die App `http://<diese-IP>:4200` an —
   also NORVI auf demselben Rechner.
3. `expo.extra.apiUrl` — plattform-verwaltete Vorschau-URL (Runable-Dashboard).

## 6. Verbindung prüfen

```bash
curl http://<lan-ip>:4200/api/health      # NORVI Web/API vom Netzwerk aus
curl http://<lan-ip>:4300                 # Expo Dev-Server vom Netzwerk aus
npx expo-doctor                           # in packages/mobile: Expo-Konfiguration prüfen
```

Beide Aufrufe müssen **von einem anderen Gerät im WLAN** funktionieren. Schlägt es fehl:
Firewall (Schritt 2), WLAN-Client-Isolation im Router oder falsches Interface
(Schritt 3, `REACT_NATIVE_PACKAGER_HOSTNAME`).

## 7. Bekannte, harmlose `expo-doctor`-Meldungen

- **„watchFolders does not contain all entries from Expo's defaults"** —
  `packages/mobile/metro.config.js` ist plattform-verwaltet und löst die Bun-Workspace-Pfade
  auf. Nicht ändern.
- **„duplicate native module dependencies"** — Artefakt der Bun-Workspace-Symlinks; es sind
  jeweils identische Versionen, kein Konflikt.

## 8. Bilder verstehen & Spracheingabe

### 8.1 Überblick

NORVI kann Bilder ansehen (beschreiben, Fragen beantworten, sichtbaren Text vorlesen) und
gesprochene Eingaben in Text umwandeln. Beides läuft **ausschließlich serverseitig** — im
Frontend liegt kein einziger Schlüssel.

- Bilder werden lokal unter `UPLOAD_DIR` (Standard `data/uploads/`) gespeichert und über
  `GET /api/files/:id` ausgeliefert.
- An das Modell gehen die **echten Bilddaten** (inline als `data:`-URL), niemals nur ein Link.
  Das ist Absicht: ein Home-Server hinter dem Router ist für einen gehosteten Modellanbieter
  nicht erreichbar.
- Die Spracherkennung spricht einen **eigenen Whisper-Server im Heimnetz** an. Ohne
  `STT_BASE_URL` bleibt der Mikrofon-Knopf ausgeblendet — es gibt bewusst keinen Cloud-Fallback.

### 8.2 Variablen in der root `.env`

```bash
UPLOAD_DIR=data/uploads                     # Ablage der hochgeladenen Bilder

AI_VISION_MODEL=                            # leer = automatische Wahl (siehe unten)
# Lokal mit Ollama z. B.: AI_VISION_MODEL=llama3.2-vision

STT_BASE_URL=                               # z. B. http://192.168.1.50:8000/v1
STT_API_KEY=                                # optional, die meisten lokalen Server brauchen keinen
STT_MODEL=Systran/faster-whisper-large-v3   # optional
```

> **Wichtig:** Änderungen an der `.env` greifen erst nach einem **echten Neustart** des
> Server-Prozesses (`bun run dev` beenden und neu starten). Ein reiner Vite-Reload übernimmt
> sie nicht.

### 8.3 Welches Vision-Modell wird benutzt?

| Konfiguration | Verhalten |
| --- | --- |
| `AI_VISION_MODEL` gesetzt | Genau dieses Modell — gilt immer und überall zuerst. |
| Gateway, Variable leer | Das aktuell gewählte Modell, falls es Bilder kann, sonst automatisch `anthropic/claude-sonnet-4.6`. |
| `AI_PROVIDER=openai-compatible`, Variable leer | Klare Fehlermeldung mit der Bitte, `AI_VISION_MODEL` zu setzen — ein reines Textmodell würde sonst raten. |

Bei lokalem Ollama also einmalig:

```bash
ollama pull llama3.2-vision
# .env: AI_VISION_MODEL=llama3.2-vision
```

### 8.4 Whisper-Server auf Ubuntu einrichten

NORVI erwartet einen **OpenAI-kompatiblen** Endpunkt (`POST <STT_BASE_URL>/audio/transcriptions`).
Am einfachsten mit `faster-whisper-server` per Docker:

```bash
# nur CPU
docker run -d --name whisper --restart unless-stopped -p 8000:8000 \
  fedirz/faster-whisper-server:latest-cpu

# mit NVIDIA-GPU (deutlich schneller)
docker run -d --name whisper --restart unless-stopped --gpus all -p 8000:8000 \
  fedirz/faster-whisper-server:latest-cuda
```

Prüfen, ob er läuft:

```bash
curl http://localhost:8000/v1/models
curl -F "file=@test.m4a" -F "model=Systran/faster-whisper-large-v3" \
  http://localhost:8000/v1/audio/transcriptions
```

Danach in der root `.env` eintragen und den NORVI-Server neu starten:

```bash
STT_BASE_URL=http://192.168.1.50:8000/v1    # LAN-IP des Whisper-Rechners, mit /v1 am Ende
STT_MODEL=Systran/faster-whisper-large-v3
```

Läuft Whisper auf **demselben** Rechner wie NORVI, genügt `http://localhost:8000/v1`.
Deutsch und Englisch werden erkannt; die Sprache wird beim Aufnehmen mitgeschickt.

### 8.5 Bedienung

- **Desktop:** Büroklammer öffnet die Dateiauswahl (JPG, JPEG, PNG, WebP, max. 12 MB). Bilder
  lassen sich auch direkt ins Eingabefeld einfügen (Strg+V).
- **Smartphone:** Der Bild-Knopf fragt „Kamera oder Galerie" — die Kamera gibt es bewusst nur
  auf dem Handy, nicht am Desktop.
- **Mikrofon:** Derselbe Knopf startet und stoppt die Aufnahme. Der erkannte Text landet
  **zuerst im Eingabefeld** und ist dort editierbar — abgeschickt wird er erst mit „Senden".

### 8.6 Backup

Die Bilder liegen als Dateien auf der Platte, die Chats in der SQLite-Datei. Für ein
vollständiges Backup **beides** sichern — `data/uploads/` und die Datenbank.

## 9. Chat über den lokalen Ollama-Server

NORVI spricht im Chat ausschließlich mit deinem Ollama im Heimnetz — keine Cloud, kein API-Key.
Die Anfragen laufen **serverseitig** über `POST /api/agent/messages`; der Browser spricht Ollama
nie direkt an, damit gibt es auch kein CORS-Problem.

### 9.1 Konfiguration (root `.env`)

```bash
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://100.114.15.10:11434/v1  # Tailscale-Adresse, /v1 ist Pflicht
AI_MODEL=norvi:latest                      # Modellname exakt wie in `ollama list`
AI_MODELS=norvi:latest                     # Auswahl in den Einstellungen
AI_API_KEY=                                # Ollama braucht keinen Schluessel
```

`AI_BASE_URL` ist der **einzige** Schalter für die Adresse. Möglich sind:

| Situation | Wert |
| --- | --- |
| NORVI und Ollama auf demselben Rechner | `http://localhost:11434/v1` |
| Über Tailscale (Tailnet-IP `100.x.y.z`) | `http://100.114.15.10:11434/v1` |
| Über einen HTTPS-Tunnel (Funnel/cloudflared) | `https://<host>/v1` |

Nicht verwenden: `172.17.0.1` (Docker-intern) und LAN-IPs wie `192.168.0.17`, wenn NORVI
außerhalb dieses WLANs läuft.

Die Cloud-Variablen `AI_GATEWAY_BASE_URL` / `AI_GATEWAY_API_KEY` sind auskommentiert. Zum
Zurückschalten `AI_PROVIDER` entfernen und die beiden Zeilen wieder aktivieren.

> **Nach jeder `.env`-Änderung den Server-Prozess wirklich neu starten** — ein Vite-Reload
> übernimmt Umgebungsvariablen nicht.

### 9.2 Ollama über Tailscale / im LAN erreichbar machen

Läuft NORVI auf **demselben** Rechner wie Ollama, genügt `http://localhost:11434/v1`.

Läuft NORVI auf einem **anderen** Rechner, muss Ollama auf allen Interfaces lauschen — per
Voreinstellung hört es nur auf `127.0.0.1`:

```bash
sudo systemctl edit ollama
# einfügen:
#   [Service]
#   Environment="OLLAMA_HOST=0.0.0.0"
sudo systemctl restart ollama

curl http://100.114.15.10:11434/api/tags    # von einem anderen Tailnet-Geraet pruefen
```

`OLLAMA_HOST=0.0.0.0` gilt auch für Tailscale: Die Tailnet-IP `100.114.15.10` ist ein eigenes
Interface, auf das Ollama nur lauscht, wenn es nicht an `127.0.0.1` gebunden ist.

Nicht `172.17.0.1` verwenden — das ist die Docker-interne Adresse, nicht deine echte Adresse.

Wichtig: Eine Tailnet-IP ist nur für Geräte erreichbar, die **im selben Tailnet angemeldet**
sind. Läuft NORVI auf einem Server außerhalb deines Tailnets, muss dieser Server entweder selbst
dem Tailnet beitreten (`tailscale up`) oder Ollama über einen HTTPS-Tunnel angeboten werden
(`tailscale funnel 11434` bzw. `cloudflared tunnel`); `AI_BASE_URL` zeigt dann auf diese
HTTPS-URL mit `/v1` am Ende.

### 9.3 Bildanalyse mit Ollama

Beim lokalen Provider wählt NORVI **kein** Modell automatisch aus — ein reines Textmodell würde
Bildinhalte sonst nur raten. Der Bild-Knopf bleibt deshalb ausgeblendet, bis ein bildfähiges
Modell eingetragen ist:

```bash
ollama pull llama3.2-vision
# .env:
AI_VISION_MODEL=llama3.2-vision
```

Kann dein eigenes Modell `norvi` bereits Bilder (also auf einer Vision-Basis gebaut), genügt
`AI_VISION_MODEL=norvi`. Der Chat selbst läuft unabhängig davon weiter über `AI_MODEL`.

---

## 10. Self-Hosting auf einem frischen Ubuntu-Server

Vollständiger Weg von einem leeren Server bis zum dauerhaften Betrieb. Getestet gegen
Ubuntu 22.04/24.04.

### 10.1 Voraussetzungen installieren

```bash
sudo apt update && sudo apt install -y git curl unzip
curl -fsSL https://bun.sh/install | bash     # Bun (Runtime + Paketmanager)
exec $SHELL                                  # PATH neu laden, danach: bun --version
```

Ollama läuft bereits auf dem Server. Modell prüfen:

```bash
ollama list                                  # muss norvi:latest enthalten
curl http://localhost:11434/api/tags         # API-Check
```

### 10.2 Projekt klonen und konfigurieren

```bash
git clone git@github.com:tomgeiersberger-arch/Norvi-4860.git norvi
cd norvi

cp .env.example .env
nano .env
```

In der `.env` mindestens setzen:

```bash
NODE_ENV=production
WEBSITE_URL=http://100.114.15.10:4200        # oder https://norvi.example.com
DATABASE_URL=file:./data/norvi.db            # lokale SQLite-Datei, kein Cloud-Dienst
DATABASE_AUTH_TOKEN=
BETTER_AUTH_SECRET=                          # openssl rand -base64 32
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://100.114.15.10:11434/v1    # bzw. http://localhost:11434/v1
AI_MODEL=norvi:latest
AI_MODELS=norvi:latest
AI_API_KEY=
UPLOAD_DIR=data/uploads
```

Die echte `.env` ist in `.gitignore` und wird **nie** committet. Genauso `data/` mit der
SQLite-Datei und den Uploads.

### 10.3 Bauen und starten

Ein Befehl macht alles — installieren, Schema anlegen, bauen, starten:

```bash
./deploy/start-production.sh
```

Das Skript bricht mit einer klaren Meldung ab, wenn Bun fehlt, die `.env` fehlt oder eine
Pflichtvariable leer ist. Varianten:

```bash
./deploy/start-production.sh --pm2         # im Hintergrund via pm2
./deploy/start-production.sh --build-only  # nur bauen
```

Die einzelnen Schritte, falls du sie getrennt brauchst:

```bash
bun install
bun run db:push        # Tabellen in der SQLite-Datei anlegen
bun run build          # Frontend + Typecheck
bun run serve          # Production-Server auf Port 4200
# oder in einem Schritt:
bun run start:prod
```

Erreichbar ist NORVI dann auf `http://<server>:4200`. Firewall:

```bash
sudo ufw allow 4200/tcp
```

### 10.4 Dauerhafter Betrieb (systemd, empfohlen)

```bash
sudo cp deploy/norvi.service /etc/systemd/system/norvi.service
sudo nano /etc/systemd/system/norvi.service   # User, WorkingDirectory, bun-Pfad anpassen
sudo systemctl daemon-reload
sudo systemctl enable --now norvi

systemctl status norvi
journalctl -u norvi -f
```

Wichtig in der Unit: `WorkingDirectory` muss das Projektverzeichnis sein — `DATABASE_URL`
und `UPLOAD_DIR` sind relative Pfade. `which bun` liefert den Pfad für `ExecStart`.

Nach jeder `.env`-Änderung: `sudo systemctl restart norvi`. Ein Reload genügt nicht,
Umgebungsvariablen werden nur beim Prozessstart gelesen.

Alternative ohne systemd (pm2, Autostart nach Reboot):

```bash
bun run build && bun run start
bunx pm2 save && bunx pm2 startup      # ausgegebenen sudo-Befehl ausfuehren
```

### 10.5 Updates einspielen

```bash
cd ~/norvi
git pull
bun install
bun run db:push
bun run build
sudo systemctl restart norvi
```

### 10.6 Optional: HTTPS über nginx

```nginx
server {
    listen 80;
    server_name norvi.example.com;

    location / {
        proxy_pass http://127.0.0.1:4200;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;          # wichtig: sonst kommt das Streaming stockend an
        proxy_read_timeout 300s;
    }
}
```

Danach `sudo certbot --nginx -d norvi.example.com` und `WEBSITE_URL` auf die HTTPS-Adresse
setzen.

### 10.7 Fehlersuche

| Symptom | Ursache / Lösung |
| --- | --- |
| „Build output not found" | `bun run build` wurde nicht ausgeführt |
| „Der KI-Dienst ist nicht erreichbar" | `AI_BASE_URL` falsch oder Ollama hört nur auf `127.0.0.1` → `OLLAMA_HOST=0.0.0.0` |
| Antwort kommt nur am Stück statt streamend | `proxy_buffering off;` im nginx fehlt |
| `.env`-Änderung wirkt nicht | Prozess wirklich neu starten (`systemctl restart norvi`) |
| Uploads verschwinden nach Neustart | `WorkingDirectory` in der Unit zeigt nicht auf das Projekt |
