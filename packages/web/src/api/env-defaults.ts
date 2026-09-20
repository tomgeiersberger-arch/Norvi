// Guarantees the database always has a usable connection URL, even when no
// .env file is present (fresh deploy, CI, or a checkout that never received the
// git-ignored root .env). Without this, `createClient({ url: undefined })` in
// database/__client.ts throws `URL_INVALID: The URL 'undefined' ...` at import
// time and takes the entire API down with an opaque "Internal server error".
//
// Override DATABASE_URL with a real libSQL/Turso URL in production for
// persistence; the local file default is only a safe fallback.
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./data/norvi.db";
}

// libSQL does not create missing parent directories for a `file:` URL, so make
// sure the folder exists before the client tries to open the database.
const url = process.env.DATABASE_URL;
if (url.startsWith("file:")) {
  const filePath = url.slice("file:".length).split("?")[0];
  try {
    mkdirSync(dirname(filePath), { recursive: true });
  } catch {
    // Best effort: on a read-only filesystem the client will surface a clearer
    // error at query time than a failed mkdir would here.
  }
}
