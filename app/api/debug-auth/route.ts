import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * TEMPORARY diagnostic endpoint. Directly queries next_auth.users with the
 * service-role key (same way the NextAuth adapter does) and returns the RAW
 * PostgREST response so we can see the real error. Delete after debugging.
 *
 * Does not leak the key — only its presence, length, and a masked preview.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

  const keyInfo = {
    present: Boolean(key),
    length: key.length,
    startsWithEyJ: key.startsWith("eyJ"),
    preview: key ? `${key.slice(0, 6)}...${key.slice(-4)}` : null,
  };

  // The Supabase URL is not a secret (it's a NEXT_PUBLIC var) — echo it raw so
  // we can spot a trailing slash / stray path.
  const result: Record<string, unknown> = {
    rawUrl: url,
    urlEndsWithSlash: url.endsWith("/"),
    keyInfo,
  };

  function summarize(error: {
    message: string;
    code?: string;
    details?: string | null;
    hint?: string | null;
  } | null) {
    return error
      ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        }
      : null;
  }

  // Test 1: next_auth schema (what the adapter uses)
  try {
    const supabase = createClient(url, key, {
      db: { schema: "next_auth" },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("users")
      .select("id, email")
      .limit(1);
    result.nextAuthSchema = { error: summarize(error), rowCount: data?.length ?? 0 };
  } catch (err) {
    result.nextAuthSchema = {
      threw: err instanceof Error ? err.message : String(err),
    };
  }

  // Test 2: public schema (default), to isolate whether the URL itself is bad
  try {
    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .limit(1);
    result.publicSchema = { error: summarize(error), rowCount: data?.length ?? 0 };
  } catch (err) {
    result.publicSchema = {
      threw: err instanceof Error ? err.message : String(err),
    };
  }

  return NextResponse.json(result, { status: 200 });
}
