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

  const result: Record<string, unknown> = { urlPresent: Boolean(url), keyInfo };

  try {
    const supabase = createClient(url, key, {
      db: { schema: "next_auth" },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await supabase
      .from("users")
      .select("id, email")
      .limit(1);

    result.queryError = error
      ? {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint,
        }
      : null;
    result.rowCount = data?.length ?? 0;
  } catch (err) {
    result.threw =
      err instanceof Error ? { name: err.name, message: err.message } : String(err);
  }

  return NextResponse.json(result, { status: 200 });
}
