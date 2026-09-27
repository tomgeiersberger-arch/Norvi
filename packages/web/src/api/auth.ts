import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins";
import { expo } from "@better-auth/expo";
import { db } from "./database";
import * as schema from "./database/schema";
import { allowAdditionalSignups } from "./lib/access";

export function trustedOrigins(): string[] {
  const configured = (process.env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin: string) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const website = process.env.WEBSITE_URL?.trim().replace(/\/$/, "");
  return [...new Set([...(website ? [website] : []), ...configured])];
}

/**
 * NORVI AI authentication.
 *
 * E-Mail/Passwort only — the app is meant to be self-hosted on a private
 * server, where an external OAuth broker would not be reachable.
 */
export const auth = betterAuth({
  basePath: "/api/auth",
  baseURL: process.env.WEBSITE_URL,
  database: drizzleAdapter(db, { provider: "sqlite" }),
  emailAndPassword: { enabled: true, minPasswordLength: 8 },
  secret: process.env.BETTER_AUTH_SECRET,
  // Never trust an arbitrary browser Origin. Add extra frontends explicitly
  // with TRUSTED_ORIGINS=https://one.example,https://two.example.
  trustedOrigins: trustedOrigins(),
  advanced: {
    // cloudflared injects the real client address. Falling back to
    // x-forwarded-for keeps other explicit reverse proxies compatible.
    ipAddress: { ipAddressHeaders: ["cf-connecting-ip", "x-forwarded-for"] },
  },
  user: {
    additionalFields: {
      // Owner/admin flag — never settable from the client.
      role: { type: "string", defaultValue: "user", input: false },
      isActive: { type: "boolean", defaultValue: true, input: false },
      isPremium: { type: "boolean", defaultValue: false, input: false },
      premiumUntil: { type: "date", required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser) => {
          // Owner bootstrap: the configured ADMIN_EMAIL, or the very first
          // account ever created, becomes admin. Never client-settable.
          const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
          const isConfiguredAdmin =
            !!adminEmail && newUser.email.trim().toLowerCase() === adminEmail;
          const [existing] = await db.select({ id: schema.user.id }).from(schema.user).limit(1);
          if (existing && !allowAdditionalSignups()) {
            throw APIError.from("FORBIDDEN", {
              message: "Registrierung ist auf diesem NORVI-Server geschlossen.",
              code: "SIGNUP_DISABLED",
            });
          }

          const role = isConfiguredAdmin || !existing ? "admin" : "user";
          return { data: { ...newUser, role } };
        },
      },
    },
  },
  plugins: [bearer(), expo()],
});
