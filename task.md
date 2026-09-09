# NORVI AI — Aufgabe: Self-Hosting auf Ubuntu-Home-Server + Konten/Admin

Produktname: **NORVI** / **NORVI AI** (exakt so, nie ändern).
Projekt: /home/user/claude-chat (Ordnername bleibt), Ports: web 4200, mobile 4300.

## Entscheidungen des Users (2026-09-01)
- Login: **E-Mail/Passwort + Admin-Bereich fertigstellen** (kein Google/Managed Auth — auf
  privatem Server nicht erreichbar).
- Datenbank: **lokale SQLite-Datei** (`DATABASE_URL=file:./data/norvi.db`), Turso optional.
- KI-Provider: **lokales Ollama / OpenAI-kompatibler Endpoint** per .env umschaltbar.
- Keine neuen Features erfinden; Bild-Upload und Sprachaufnahme sind NICHT Teil dieser Runde.

## Status

### Backend — fertig geschrieben (noch nicht verifiziert)
- [x] `api/auth.ts` — Better Auth, E-Mail/Passwort, bearer()+expo(), additionalFields
      (role/isActive/isPremium/premiumUntil), Owner-Bootstrap (ADMIN_EMAIL oder erster Account).
- [x] `api/database/auth-schema.ts` generiert, in `schema.ts` re-exportiert; `chats.userId`,
      Tabelle `user_settings`; db:push gelaufen (chats.userId + auth-Tabellen).
- [x] `api/middleware/auth.ts` — withUser / authed / adminOnly.
- [x] `api/lib/rate-limit.ts` — 30 Nachrichten / 10 min pro User bzw. Device.
- [x] `api/agent/gateway.ts` — Provider-Umschaltung gateway | openai-compatible (Ollama).
- [x] `api/agent/index.ts` — createAgent({modelId, temperature}), AGENT_NAME "NORVI".
- [x] `api/routes/chats.ts` — Scoping über User (Fallback deviceId).
- [x] `api/routes/me.ts`, `settings.ts`, `admin.ts`.
- [x] `api/index.ts` — Auth gemountet, Session + Rate-Limit + Settings im Streaming-Endpoint.
- [ ] db:push für `user_settings` erneut laufen lassen (nach Schema-Ergänzung!).

### Frontend — in Arbeit
- [x] `web/lib/auth.ts`, `web/lib/api.ts` (Bearer + credentials).
- [x] `web/queries/me.ts`, `settings.ts`, `admin.ts`.
- [ ] `web/pages/sign-in.tsx`, `web/pages/admin.tsx`, `components/protected-route.tsx`,
      `components/settings-dialog.tsx`, User-Menü in Sidebar, Routen in `app.tsx`.
- [ ] Umbenennen aller sichtbaren "Norvi" → "NORVI" / "NORVI AI".
- [ ] `queries/chats.ts` ohne deviceId (Web nutzt Konto).

### Deployment (Ubuntu-Home-Server)
- [ ] `.env.example` (alle Variablen, keine Werte) — lint prüfen, ob erlaubt.
- [ ] `README.md` — Setup, Startbefehle, Ports, Reverse Proxy, systemd.
- [ ] Host-Bindung 0.0.0.0 im Prod-Server (PORT/HOST aus env; `src/__server.ts` ist
      template-managed → NICHT editieren, stattdessen eigener Startpfad/Doku prüfen).
- [ ] Dockerfile + docker-compose.yml (optional, Betrieb ohne Docker bleibt möglich).
- [ ] systemd-Unit-Beispiel.

### Verifikation
- [ ] `bun run lint`, `bun run typecheck`, `bun run build`
- [ ] E2E: Registrieren → Chat → Reload → Umbenennen → Löschen → zweiter User sieht nichts →
      Admin-Seite für normalen User gesperrt.

---

## Runde: Expo-Go-Vorschau (2026-09-02)

Auftrag: ausschließlich die mobile Expo-Go-Vorschau reparieren, Name NORVI unverändert,
kein Branding-/Design-Eingriff, keine Funktion entfernt.

Geändert:
- `packages/mobile/lib/api-base.ts` (neu): LAN-bewusste Auflösung der API-Basis-URL.
- `packages/mobile/lib/api.ts`, `packages/mobile/app/index.tsx`: nutzen die neue Auflösung;
  sichtbare Texte auf „NORVI“/„NORVI AI“ korrigiert.
- `packages/mobile/app.json`: `expo.name` = „NORVI AI“; iOS-`bundleIdentifier` ohne Unterstrich
  (Schema-Fehler); `expo-font`-Plugin durch `expo install` ergänzt. `extra`/`scheme` unangetastet.
- `package.json` (Root): `dev:mobile` nutzt `--host lan` als Standard, zusätzlich
  `dev:mobile:tunnel` und `dev:mobile:localhost`.
- `packages/mobile/package.json`: SDK-54-Versionen via `npx expo install --fix` angeglichen,
  fehlende Peer-Dependency `expo-font` nachinstalliert.
- `README.md`: Abschnitt „NORVI AI — Mobile App über Expo Go im Heimnetz“.

Verifiziert: `bun run lint`, `bun run typecheck`, `bun run build` grün; Android- und
iOS-Bundle über Metro erfolgreich (je ~9,9 MB, HTTP 200); Web 4200 = 200, `/api/health` = 200;
`expo-doctor` 16/18 (Restmeldungen dokumentiert und harmlos).

Unverändert offen (aus der Vorrunde, nicht Teil dieses Auftrags): Auth-/Admin-Routen in
`src/web/app.tsx` noch nicht verdrahtet, `db:push` für `user_settings` noch offen.

## Runde Vision + Speech-to-Text (Stand 2026-09-04)

Fertig:
- Backend: lib/uploads.ts, lib/stt.ts (Whisper, OpenAI-kompatibel), gateway.ts (visionModelId/visionAvailable),
  agent/index.ts (Bild-Regeln im System-Prompt), schema.ts (chat_messages.attachments) + db:push OK,
  routes/chats.ts (attachments), routes/capabilities.ts, index.ts (/api/upload, /api/files/:id, /api/transcribe)
- Web: queries/capabilities.ts, lib/uploads.ts, lib/recorder.ts, composer.tsx (Bild + Mikro + Status), message.tsx (Bilder + Lightbox), chat-pane.tsx
- Mobile: expo-image-picker + expo-audio installiert, lib/media.ts, queries/capabilities.ts, app/index.tsx (send mit Bildern, Kamera/Galerie, Aufnahme)

Erledigt zusaetzlich:
- index.ts: Vision-Routing (visionModelId + withAbsoluteImages) und attachments-Persistenz
- Mobile: Composer-UI (Bild-/Mikro-Button, Thumbnails, Aufnahme-Status), Bilder in Bubbles
- Namens-Korrektur Norvi -> NORVI (pages/index.tsx, norvi-mark.tsx, index.html, design.md)
- lint OK, typecheck OK

Abgeschlossen (2026-09-08):
- index.ts: `withAbsoluteImages` -> `withInlineImages` — die echten Bilddaten gehen als
  `data:`-URL an das Modell (ein Home-Server ist fuer den Anbieter nicht erreichbar);
  Fallback auf absolute URL nur bei fremden URLs. Persistiert bleibt die kurze /api/files/<id>-URL.
- gateway.ts: `unwrapFileParts` + `gatewayFetch`. Ursache des 400 "Invalid input":
  der Gateway erwartet bei file-Parts `data` als String/Uint8Array/URL, ai@7 sendet
  `{type:"data",data:"<base64>"}`. Der Shim packt genau diese Form auf der Leitung aus.
- empty-state.tsx + chat-pane.tsx: Hinweis-Chips fuer Bild-Upload und Mikrofon (nur wenn aktiv).
- README Abschnitt 8 "Bilder verstehen & Spracheingabe" (Whisper-Setup, Variablen, Bedienung, Backup).

Verifiziert (echte HTTP-Tests gegen localhost:4200):
- POST /api/upload -> 201 {url, mediaType, bytes:3392}
- GET /api/files/<id> -> 200, content-type image/png; unbekannte id -> 404; Traversal -> 404
- POST /api/agent/messages mit Bild -> echte Beschreibung ("rotes Quadrat", "blauer Kreis",
  Text "NORVI TESTBILD 42") — korrekt erkannt
- Halluzinations-Test ("Wie viele Katzen?") -> "keine Katzen", "keine Telefonnummer"
- chats.messages -> attachments als kurze URL gespeichert, kein base64 in der DB
- Reiner Text-Chat weiterhin OK (Regression)
- /api/transcribe ohne STT_BASE_URL -> 503 "nicht eingerichtet"; mit totem Host -> 503
  "Whisper-Server ... nicht erreichbar"; capabilities meldet stt true/false passend
- lint, typecheck, build gruen; Metro-Bundle Android + iOS je ~10 MB, HTTP 200, 0 Resolver-Fehler
  (richtiger Pfad: /.expo/.virtual-metro-entry.bundle?platform=...)

Nicht abschliessend testbar (ehrlich):
- Echte Transkription — kein Whisper-Server in dieser Umgebung; nur die Fehlerpfade sind belegt.
- Kamera-/Mikrofon-Berechtigungen in Expo Go — braucht ein echtes Smartphone.

Wichtig fuer den Betrieb: .env-Aenderungen greifen erst nach echtem Prozess-Neustart,
ein Vite-Reload uebernimmt sie nicht.

## Runde lokaler Ollama-Server (2026-09-08)

Umstellung ist reine Konfiguration — `resolveModel()` in agent/gateway.ts ist der einzige
Umschaltpunkt, der openai-compatible Pfad existierte bereits.

- .env: AI_PROVIDER=openai-compatible, AI_BASE_URL=http://192.168.0.17:11434/v1,
  AI_MODEL=norvi, AI_MODELS=norvi, AI_API_KEY leer.
  AI_GATEWAY_BASE_URL/-API_KEY auskommentiert (kein externer Dienst, kein externer Key).
- README Abschnitt 9 (Ollama-Konfiguration, OLLAMA_HOST=0.0.0.0, Bildanalyse-Hinweis).
- Kein Codeeingriff noetig: settings.present() validiert gespeicherte Modell-IDs bereits gegen
  availableModels(), ein alter Cloud-Wert faellt automatisch auf "norvi" zurueck.

Verifiziert gegen einen lokalen Ollama-kompatiblen Testserver (/tmp/ollama_stub.py, nicht Teil
des Projekts), weil 192.168.0.17 aus der Sandbox nicht erreichbar ist:
- "Hallo NORVI" -> Antwort kam streamend im Chat an
- Gesendet wurde: POST /v1/chat/completions, model="norvi", stream=true, System-Prompt "You are NORVI"
- Kein Aufruf an eine Cloud-API
- Ollama nicht erreichbar -> verstaendliche deutsche Meldung mit Hinweis auf AI_BASE_URL
- lint, typecheck, build gruen

Offen / nur bei ihm testbar:
- Echter Test gegen 192.168.0.17 mit seinem Modell "norvi" (Heimnetz, von hier nicht erreichbar).
- Vision ist mit dem lokalen Provider aus, bis AI_VISION_MODEL gesetzt ist (capabilities.vision=false).
- STT unveraendert aus, bis STT_BASE_URL gesetzt ist.

## Runde Tailscale-Adresse (2026-09-09)

Umstellung von der LAN-IP auf die Tailnet-Adresse — weiterhin reine Konfiguration.

- .env: AI_BASE_URL=http://100.114.15.10:11434/v1, AI_MODEL=norvi:latest, AI_MODELS=norvi:latest.
  AI_PROVIDER=openai-compatible und leerer AI_API_KEY unveraendert, Cloud-Variablen bleiben aus.
- Kein Codeeingriff: availableModels() splittet nur an Kommas, der Doppelpunkt in "norvi:latest"
  bleibt unveraendert; defaultModelId() gibt den konfigurierten Wert beim lokalen Provider
  auch dann zurueck, wenn er nicht in der Liste steht.
- README Abschnitt 9: Tabelle der moeglichen AI_BASE_URL-Werte (localhost / Tailnet-IP / HTTPS-Tunnel),
  Hinweis dass OLLAMA_HOST=0.0.0.0 auch fuer das Tailscale-Interface gilt und dass eine
  Tailnet-IP nur fuer Geraete im selben Tailnet erreichbar ist.

Verifiziert (Testserver /tmp/ollama_stub.py auf 127.0.0.1:11434, nicht Teil des Projekts):
- "Hallo NORVI" -> Antwort kam streamend als text-delta-Folge im Chat an
- Mitgeschnitten: POST /v1/chat/completions, model="norvi:latest", stream=true
- Kein Cloud-Aufruf
- Danach auf 100.114.15.10 zurueckgestellt -> verstaendliche Meldung
  "Der KI-Dienst ist nicht erreichbar. Laeuft der Endpoint aus AI_BASE_URL (z. B. Ollama)?"
- lint, typecheck, build gruen

Offen:
- 100.114.15.10 ist aus dieser Sandbox nicht erreichbar (curl -> HTTP 000, kein tailscale-Binary,
  Sandbox ist kein Tailnet-Mitglied). Ein Backend-Proxy im selben Sandbox-Netz loest das NICHT,
  weil ihm die Route ins Tailnet genauso fehlt. Es braucht entweder einen Tailnet-Beitritt der
  Sandbox (ephemeral Auth Key) oder eine HTTPS-Tunnel-URL fuer AI_BASE_URL.
