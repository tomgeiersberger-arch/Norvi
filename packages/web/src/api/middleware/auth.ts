import { ORPCError } from "@orpc/server";
import { base } from "../__core/app";
import { auth } from "../auth";
import { hasAdminAccess, hasPremiumAccess, isOwnerRole } from "../lib/access";
import { publicEditionEnabled } from "../lib/privacy";

/** Shape of the session user we hand down to procedures. */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  role: string;
  isActive: boolean;
  isPremium: boolean;
  premiumUntil?: Date | null;
  chokeModeEnabled: boolean;
  premiumAccess: boolean;
};

function asUser(user: unknown): SessionUser {
  const u = user as SessionUser;
  return {
    ...u,
    role: u.role ?? "user",
    isActive: u.isActive ?? true,
    isPremium: u.isPremium ?? false,
    chokeModeEnabled: u.chokeModeEnabled ?? false,
    premiumAccess: hasPremiumAccess(u),
  };
}

/** Optional auth — `context.user` is the session user or null. */
export const withUser = base.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  const user = session?.user ? asUser(session.user) : null;
  return next({
    context: { user: user && user.isActive ? user : null },
  });
});

/** Protected procedures — rejects unauthenticated or deactivated accounts. */
export const authed = base.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session) throw new ORPCError("UNAUTHORIZED", { message: "Bitte anmelden." });
  const user = asUser(session.user);
  if (!user.isActive) {
    throw new ORPCError("FORBIDDEN", { message: "Dieses Konto ist deaktiviert." });
  }
  return next({ context: { user } });
});

/** Administration procedures: Owner and Admin. */
export const adminOnly = authed.use(({ context, next }) => {
  if (publicEditionEnabled()) {
    throw new ORPCError("FORBIDDEN", {
      message: "Administration ist in der öffentlichen NORVI-Version deaktiviert.",
    });
  }
  if (!hasAdminAccess(context.user.role)) {
    throw new ORPCError("FORBIDDEN", { message: "Kein Zugriff." });
  }
  return next({ context });
});

/** Owner-only procedures for role/security changes. */
export const ownerOnly = authed.use(({ context, next }) => {
  if (publicEditionEnabled()) {
    throw new ORPCError("FORBIDDEN", {
      message: "Owner-Verwaltung ist in der öffentlichen NORVI-Version deaktiviert.",
    });
  }
  if (!isOwnerRole(context.user.role)) {
    throw new ORPCError("FORBIDDEN", { message: "Nur der Owner darf das ändern." });
  }
  return next({ context });
});
