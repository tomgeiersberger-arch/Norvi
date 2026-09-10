import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Datenbank-Ziel kommt ausschliesslich aus der root `.env`:
 *
 *  - Self-Hosting:  DATABASE_URL=file:./data/norvi.db   (lokale SQLite-Datei)
 *  - Turso/libsql:  DATABASE_URL=libsql://...           + DATABASE_AUTH_TOKEN
 *
 * Der libsql-Treiber versteht beide Formen.
 *
 * Wichtig bei lokalen Dateien: drizzle-kit laeuft in `packages/web`, der Server
 * dagegen im Projekt-Root. Ein relativer Pfad wuerde deshalb auf zwei
 * verschiedene Dateien zeigen. Wir loesen ihn hier gegen den Projekt-Root auf,
 * damit `bun run db:push` und der laufende Server dieselbe Datei benutzen.
 */
/** Projekt-Root = das Verzeichnis mit `__ports.cjs`, von hier aus nach oben gesucht. */
function findProjectRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    if (existsSync(path.join(dir, "__ports.cjs"))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

const projectRoot = findProjectRoot();
const raw = (process.env.DATABASE_URL ?? "").trim();
const isLocalFile = raw.startsWith("file:");

function resolveUrl(): string {
  if (!isLocalFile) return raw;
  const filePath = raw.slice("file:".length);
  if (path.isAbsolute(filePath)) return raw;
  return `file:${path.resolve(projectRoot, filePath)}`;
}

export default defineConfig({
  dialect: "turso",
  schema: "./src/api/database/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: resolveUrl(),
    // Lokale Dateien haben keinen Token, drizzle-kit verlangt aber einen Wert.
    authToken: process.env.DATABASE_AUTH_TOKEN || (isLocalFile ? "local-file" : undefined),
  },
});
