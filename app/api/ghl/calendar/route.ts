import { NextResponse } from "next/server";
import { getCurrentUser, hasGhlCreds } from "@/lib/session";
import { createCalendarEvent, deleteCalendarEvent } from "@/lib/ghl";
import type { GhlCalendarEventInput } from "@/types";

/**
 * Server-side proxy for GHL calendar calls.
 *
 * POST   { data }       -> create calendar event
 * DELETE { eventId }    -> delete calendar event
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasGhlCreds(user))
    return NextResponse.json({ error: "GHL not connected" }, { status: 400 });

  const body = (await req.json()) as { data: GhlCalendarEventInput };
  const res = await createCalendarEvent(
    user.ghl_location_id,
    user.ghl_api_key,
    body.data,
  );
  return NextResponse.json(res, { status: res.ok ? 200 : res.status || 500 });
}

export async function DELETE(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasGhlCreds(user))
    return NextResponse.json({ error: "GHL not connected" }, { status: 400 });

  const body = (await req.json()) as { eventId: string };
  const res = await deleteCalendarEvent(
    user.ghl_location_id,
    user.ghl_api_key,
    body.eventId,
  );
  return NextResponse.json(res, { status: res.ok ? 200 : res.status || 500 });
}
