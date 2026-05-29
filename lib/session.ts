import { auth } from "@/lib/auth";
import { createServiceSupabase } from "@/lib/supabase";
import type { UserRecord } from "@/types";

/**
 * Resolve the full Supabase user record (incl. GHL credentials) for the
 * currently authenticated session. Returns null if not signed in.
 *
 * Uses the service client because credentials must be read server-side only.
 */
export async function getCurrentUser(): Promise<UserRecord | null> {
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return null;

  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  return (data as UserRecord | null) ?? null;
}

/**
 * Throwing variant for route handlers — guarantees a user or 401-style error.
 */
export async function requireUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}

/**
 * Ensure the user has connected GHL credentials before making API calls.
 */
export function hasGhlCreds(
  user: UserRecord,
): user is UserRecord & { ghl_location_id: string; ghl_api_key: string } {
  return Boolean(user.ghl_location_id && user.ghl_api_key);
}
