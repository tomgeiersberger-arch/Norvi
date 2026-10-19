# NORVI v0.1.8

## Update-System 2.0 fuer Windows

- Beim Aktualisieren prueft NORVI den Start der lokalen Dienste (Bun, NORVI API, Ollama und Whisper/STT).
- Schlaegt die neue Runtime fehl, aktiviert NORVI automatisch das vorherige Runtime-Verzeichnis und versucht, die bisherige Installation wieder zu starten.
- Lokale Konfigurationen, Chats, Modelle und andere Nutzerdaten werden beim Update nicht absichtlich geloescht.
- Nach einem fehlgeschlagenen Upgrade wartet NORVI vor einem neuen automatischen Versuch 24 Stunden, damit keine Endlosschleife entsteht.
- Regressionstests wurden unter Linux und Windows ausgefuehrt; der Windows-Installer wurde automatisch installiert und sein Start getestet.

## Hinweis

Die Tests pruefen den Installer und das Rueckschalten der Runtime. Ein Upgrade mit realen bestehenden Benutzerdaten auf einem Windows-PC wurde noch nicht manuell nachgestellt. Bitte zur Sicherheit vor dem Update eine Kopie von `%APPDATA%\Norvi AI` anlegen.
