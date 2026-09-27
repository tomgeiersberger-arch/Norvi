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
function enabled(value: string | undefined): boolean {
  const raw = (value ?? "").trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

export function requireAuthEnabled(): boolean {
  return enabled(process.env.REQUIRE_AUTH);
}

/** Additional account registration is closed by default after owner bootstrap. */
let runtimeSignupOverride: boolean | null = null;

export function allowAdditionalSignups(): boolean {
  return runtimeSignupOverride ?? enabled(process.env.ALLOW_SIGNUP);
}

/**
 * Owner-only runtime switch used by the admin UI.
 *
 * It intentionally resets after a server restart, so accidentally opening
 * registration never becomes a permanent public setting.
 */
export function setRuntimeSignupEnabled(value: boolean): boolean {
  runtimeSignupOverride = value;
  return allowAdditionalSignups();
}

/** Active Premium access. Administrators always get the full local feature set. */
export function hasPremiumAccess(
  user:
    | {
        role?: string;
        isPremium?: boolean;
        premiumUntil?: Date | string | number | null;
      }
    | null
    | undefined,
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (!user.isPremium) return false;
  if (!user.premiumUntil) return true;

  const until = new Date(user.premiumUntil).getTime();
  return Number.isFinite(until) && until > Date.now();
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
