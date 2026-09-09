import { withUser } from "../middleware/auth";

/** Current account (or null when signed out) — drives the NORVI AI UI shell. */
export const me = withUser.handler(({ context }) => {
  const user = context.user;
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isPremium: user.isPremium,
    premiumUntil: user.premiumUntil ?? null,
  };
});
