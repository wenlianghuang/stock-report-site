import { createClient } from "@/lib/supabase/server";

export { mapAuthError } from "./auth-errors";

export type AuthUser = {
  id: string;
  email: string;
};

function emailFromClaims(claims: Record<string, unknown>): string | null {
  if (typeof claims.email === "string" && claims.email) {
    return claims.email;
  }
  const meta = claims.user_metadata;
  if (
    meta &&
    typeof meta === "object" &&
    typeof (meta as { email?: unknown }).email === "string" &&
    (meta as { email: string }).email
  ) {
    return (meta as { email: string }).email;
  }
  return null;
}

/**
 * Gate on a locally verified JWT (getClaims / JWKS), matching middleware.
 * Avoids a per-request Auth server round-trip from getUser().
 */
export async function requireUser(): Promise<AuthUser | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims) {
    return null;
  }

  const claims = data.claims as Record<string, unknown>;
  const id = typeof claims.sub === "string" ? claims.sub : null;
  const email = emailFromClaims(claims);

  if (!id || !email) {
    return null;
  }

  return { id, email };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
}

