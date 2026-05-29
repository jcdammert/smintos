import { NextResponse } from "next/server";
import { getCurrentUser, hasGhlCreds } from "@/lib/session";
import { createContact, updateContact } from "@/lib/ghl";
import type { GhlContactInput } from "@/types";

/**
 * Server-side proxy for GHL contact calls. API keys are read from the
 * authenticated user's record and never leave the server.
 *
 * POST   { data }                  -> create contact
 * PUT    { contactId, data }       -> update contact
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasGhlCreds(user))
    return NextResponse.json({ error: "GHL not connected" }, { status: 400 });

  const body = (await req.json()) as { data: GhlContactInput };
  const res = await createContact(
    user.ghl_location_id,
    user.ghl_api_key,
    body.data,
  );
  return NextResponse.json(res, { status: res.ok ? 200 : res.status || 500 });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasGhlCreds(user))
    return NextResponse.json({ error: "GHL not connected" }, { status: 400 });

  const body = (await req.json()) as {
    contactId: string;
    data: GhlContactInput;
  };
  const res = await updateContact(
    user.ghl_location_id,
    user.ghl_api_key,
    body.contactId,
    body.data,
  );
  return NextResponse.json(res, { status: res.ok ? 200 : res.status || 500 });
}
