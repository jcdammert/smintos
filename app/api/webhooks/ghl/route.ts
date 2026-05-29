import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceSupabase } from "@/lib/supabase";

/**
 * GHL webhook receiver. Verifies the signature, then syncs supported events
 * into Supabase. Always returns 200 on success so GHL stops retrying.
 *
 * Supported events:
 *   contact.created / contact.updated      -> upsert clients
 *   invoice.paid                           -> mark invoice paid
 *   appointment.created / appointment.updated -> upsert appointments
 */

interface GhlWebhookPayload {
  type?: string;
  event?: string;
  locationId?: string;
  [key: string]: unknown;
}

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  // If no secret is configured, accept (useful in early dev). In prod, set it.
  if (!secret) return true;
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

async function resolveUserId(
  supabase: ReturnType<typeof createServiceSupabase>,
  locationId: string | undefined,
): Promise<string | null> {
  if (!locationId) return null;
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("ghl_location_id", locationId)
    .maybeSingle();
  return data?.id ?? null;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature =
    req.headers.get("x-ghl-signature") ??
    req.headers.get("x-wh-signature") ??
    null;

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: GhlWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as GhlWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const eventType = payload.type ?? payload.event ?? "";
  const supabase = createServiceSupabase();
  const userId = await resolveUserId(supabase, payload.locationId);

  // Unknown location -> nothing to sync, but acknowledge so GHL stops retrying.
  if (!userId) return NextResponse.json({ ok: true, skipped: true });

  try {
    switch (eventType) {
      case "contact.created":
      case "contact.updated":
      case "ContactCreate":
      case "ContactUpdate": {
        const c = (payload.contact ?? payload) as Record<string, unknown>;
        const contactId = String(c.id ?? "");
        if (!contactId) break;
        await supabase
          .from("clients")
          .upsert(
            {
              user_id: userId,
              ghl_contact_id: contactId,
              name:
                String(c.name ?? "") ||
                `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() ||
                "Unnamed",
              phone: (c.phone as string | null) ?? null,
              email: (c.email as string | null) ?? null,
              address: (c.address1 as string | null) ?? null,
              city: (c.city as string | null) ?? null,
              state: (c.state as string | null) ?? null,
              postal_code: (c.postalCode as string | null) ?? null,
              country: (c.country as string | null) ?? null,
            },
            { onConflict: "ghl_contact_id" },
          );
        break;
      }

      case "invoice.paid":
      case "InvoicePaid": {
        const inv = (payload.invoice ?? payload) as Record<string, unknown>;
        const invoiceId = String(inv.id ?? inv._id ?? "");
        if (!invoiceId) break;
        await supabase
          .from("invoices")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("ghl_invoice_id", invoiceId);
        break;
      }

      case "appointment.created":
      case "appointment.updated":
      case "AppointmentCreate":
      case "AppointmentUpdate": {
        const a = (payload.appointment ?? payload) as Record<string, unknown>;
        const eventId = String(a.id ?? "");
        if (!eventId) break;
        await supabase.from("appointments").upsert(
          {
            user_id: userId,
            ghl_event_id: eventId,
            title: String(a.title ?? "Appointment"),
            notes: (a.notes as string | null) ?? null,
            scheduled_at:
              (a.startTime as string | null) ?? new Date().toISOString(),
            duration_minutes: Number(a.duration ?? 60) || 60,
            assigned_to: (a.assignedUserId as string | null) ?? null,
            // client_id intentionally omitted: on insert it stays null (nullable),
            // and on conflict-update we avoid clobbering an in-app appointment's client.
          },
          { onConflict: "ghl_event_id" },
        );
        break;
      }

      default:
        // Unhandled event types are acknowledged but ignored.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
