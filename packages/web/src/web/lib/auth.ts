import { createAuthClient } from "better-auth/react";

const TOKEN_KEY = "norvi.auth-token";

export function getAuthToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function storeToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage disabled — the session cookie still works */
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * NORVI AI auth client (E-Mail/Passwort).
 *
 * The session rides on both the cookie and a bearer token: the token keeps the
 * session working when NORVI is embedded in an iframe or served from a
 * different host in the home network.
 */
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: "/api/auth",
  fetchOptions: {
    credentials: "include",
    auth: { type: "Bearer", token: () => getAuthToken() },
    onSuccess: (ctx) => {
      const token = ctx.response.headers.get("set-auth-token");
      if (token) storeToken(token);
    },
  },
});
