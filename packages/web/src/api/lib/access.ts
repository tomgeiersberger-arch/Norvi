/**
 * Zugriffsschutz für die selbst gehostete NORVI-Instanz.
 *
 * Standard (ohne Konfiguration) bleibt der bisherige Betrieb: der Chat läuft
 * ohne Anmeldung über die `deviceId` des Clients. Sobald der Server aus dem
 * Internet erreichbar ist, wird
 *
 *   REQUIRE_AUTH=true
 *
 * in der root `.env` gesetzt — dann verlangt jeder Endpunkt, der Rechenzeit
 * kostet oder Daten schreibt, eine gültige Sitzung.
 */

/** True, wenn die Instanz eine Anmeldung erzwingt. */
export function requireAuthEnabled(): boolean {
  const raw = (process.env.REQUIRE_AUTH ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

/** Meldung für abgewiesene anonyme Anfragen — identisch auf allen Endpunkten. */
export const AUTH_REQUIRED_MESSAGE =
  "Für diese NORVI-Instanz ist eine Anmeldung erforderlich. Bitte anmelden.";

/**
 * Prüft eine anonyme Anfrage gegen die Zugriffsregel.
 *
 * @returns `true`, wenn die Anfrage abgewiesen werden muss.
 */
export function denyAnonymous(user: { id: string } | null | undefined): boolean {
  return requireAuthEnabled() && !user;
}
