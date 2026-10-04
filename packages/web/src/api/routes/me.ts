import { withUser } from "../middleware/auth";
import { publicEditionEnabled } from "../lib/privacy";

/** Current account (or null when signed out) — drives the NORVI AI UI shell. */
export const me = withUser.handler(({ context }) => {
  const user = context.user;
  if (!user) return null;
  const publicEdition = publicEditionEnabled();
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: publicEdition ? "user" : user.role,
    isPremium: publicEdition ? false : user.isPremium,
    premiumUntil: publicEdition ? null : (user.premiumUntil ?? null),
    premiumAccess: publicEdition ? false : user.premiumAccess,
  };
});
