import { NextResponse } from "next/server";
import crypto from "crypto";
import { createServiceSupabase } from "@/lib/supabase";

/**
 * GHL webhook receiver. Authenticates, then syncs supported events into
 * Supabase. Always returns 200 on success so GHL stops retrying.
 *
 * Auth (any of):
 *   - HMAC SHA256 in `x-ghl-signature` / `x-wh-signature` (for marketplace apps)
 *   - Shared-secret token in `?secret=…` query param (easiest for Workflows)
 *   - Shared-secret token in `x-smintos-secret` header
 *
 * Event type (any of):
 *   - `?type=contact.created` query param (cleanest for GHL Workflow Webhooks)
 *   - `payload.type` / `payload.event` in body (for marketplace-style payloads)
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
  location_id?: string;
  [key: string]: unknown;
}

function pickString(obj: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

function verifyAuth(req: Request, rawBody: string): boolean {
  const secret = process.env.GHL_WEBHOOK_SECRET;
  // No secret configured -> accept (only happens in early dev).
  if (!secret) return true;

  // 1) HMAC signature header (marketplace style)
  const sig =
    req.headers.get("x-ghl-signature") ??
    req.headers.get("x-wh-signature") ??
    null;
  if (sig) {
    try {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");
      if (
        expected.length === sig.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
      ) {
        return true;
      }
    } catch {
      /* fall through to token check */
    }
  }

  // 2) Shared-secret token (Workflow webhook style)
  const url = new URL(req.url);
  const provided =
    url.searchParams.get("secret") ??
    req.headers.get("x-smintos-secret") ??
    null;
  if (provided && provided === secret) return true;

  return false;
}

async function resolveUserId(
  supabase: ReturnType<typeof createServiceSupabase>,
  locationId: string | undefined | null,
): Promise<string | null> {
  if (!locationId) return null;
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("ghl_location_id", locationId)
    .maybeSingle();
  return data?.id ?? null;
}

async function resolveClientId(
  supabase: ReturnType<typeof createServiceSupabase>,
  userId: string,
  ghlContactId: string | null | undefined,
): Promise<string | null> {
  if (!ghlContactId) return null;
  const { data } = await supabase
    .from("clients")
    .select("id")
    .eq("user_id", userId)
    .eq("ghl_contact_id", ghlContactId)
    .maybeSingle();
  return data?.id ?? null;
}

function pickArray(obj: Record<string, unknown>, keys: string[]): unknown[] {
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) return v;
  }
  return [];
}

function pickNumber(
  obj: Record<string, unknown>,
  keys: string[],
): number {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() && !isNaN(Number(v))) return Number(v);
  }
  return 0;
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  if (!verifyAuth(req, rawBody)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: GhlWebhookPayload;
  try {
    payload = (rawBody ? JSON.parse(rawBody) : {}) as GhlWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  // Event type can come from the URL (?type=...) OR the body.
  const url = new URL(req.url);
  const eventType =
    url.searchParams.get("type") ?? payload.type ?? payload.event ?? "";

  // Location can come from many shapes depending on event source.
  const locationId =
    payload.locationId ??
    payload.location_id ??
    (payload.location as { id?: string } | undefined)?.id ??
    null;

  // Log briefly so we can iterate on payload shape as real events come in.
  console.log("GHL_WEBHOOK", {
    eventType,
    locationId,
    keys: Object.keys(payload),
  });

  const supabase = createServiceSupabase();
  const userId = await resolveUserId(supabase, locationId);

  // Unknown location -> nothing to sync, but acknowledge so GHL stops retrying.
  if (!userId) return NextResponse.json({ ok: true, skipped: "no-user" });

  try {
    switch (eventType) {
      case "contact.created":
      case "contact.updated":
      case "ContactCreate":
      case "ContactUpdate": {
        const c = (payload.contact ?? payload) as Record<string, unknown>;
        const contactId =
          pickString(c, ["id", "contact_id", "contactId", "_id"]) ?? "";
        if (!contactId) break;
        const first = pickString(c, ["firstName", "first_name"]) ?? "";
        const last = pickString(c, ["lastName", "last_name"]) ?? "";
        const fullName =
          pickString(c, ["contactName", "fullNameLowerCase", "name"]) ||
          `${first} ${last}`.trim() ||
          "Unnamed";

        await supabase.from("clients").upsert(
          {
            user_id: userId,
            ghl_contact_id: contactId,
            name: fullName,
            phone: pickString(c, ["phone", "phone_number"]),
            email: pickString(c, ["email"]),
            address: pickString(c, ["address1", "address", "full_address"]),
            city: pickString(c, ["city"]),
            state: pickString(c, ["state"]),
            postal_code: pickString(c, ["postalCode", "postal_code"]),
            country: pickString(c, ["country"]),
          },
          { onConflict: "ghl_contact_id" },
        );
        break;
      }

      case "invoice.paid":
      case "InvoicePaid": {
        const inv = (payload.invoice ?? payload) as Record<string, unknown>;
        const invoiceId =
          pickString(inv, ["id", "invoice_id", "invoiceId", "_id"]) ?? "";
        if (!invoiceId) break;
        await supabase
          .from("invoices")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("ghl_invoice_id", invoiceId);
        break;
      }

      case "invoice.created":
      case "invoice.sent":
      case "InvoiceCreated":
      case "InvoiceSent": {
        const inv = (payload.invoice ?? payload) as Record<string, unknown>;
        const ghlInvId =
          pickString(inv, ["id", "invoice_id", "invoiceId", "_id"]) ?? "";
        if (!ghlInvId) break;

        // Update if we already have it; otherwise create when we can find the client.
        const { data: existing } = await supabase
          .from("invoices")
          .select("id")
          .eq("user_id", userId)
          .eq("ghl_invoice_id", ghlInvId)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("invoices")
            .update({ status: "sent" })
            .eq("id", existing.id);
        } else {
          const contactId = pickString(inv, ["contactId", "contact_id"]);
          const clientId = await resolveClientId(supabase, userId, contactId);
          if (!clientId) break; // can't link to a client yet — skip until contact syncs
          await supabase.from("invoices").insert({
            user_id: userId,
            client_id: clientId,
            ghl_invoice_id: ghlInvId,
            invoice_number:
              pickString(inv, ["invoiceNumber", "invoice_number", "number"]) ??
              `INV-${ghlInvId.slice(-6)}`,
            line_items: pickArray(inv, ["items", "lineItems", "line_items"]),
            total: pickNumber(inv, ["amount", "total", "totalAmount"]),
            status: "sent",
            due_date: pickString(inv, ["dueDate", "due_date"]),
          });
        }
        break;
      }

      case "estimate.created":
      case "estimate.sent":
      case "estimate.accepted":
      case "estimate.declined":
      case "EstimateCreated":
      case "EstimateSent":
      case "EstimateAccepted":
      case "EstimateDeclined": {
        const e = (payload.estimate ?? payload) as Record<string, unknown>;
        const ghlEstId =
          pickString(e, ["id", "estimate_id", "estimateId", "_id"]) ?? "";
        if (!ghlEstId) break;

        const status =
          eventType === "estimate.accepted" || eventType === "EstimateAccepted"
            ? "approved"
            : eventType === "estimate.declined" ||
                eventType === "EstimateDeclined"
              ? "declined"
              : eventType === "estimate.sent" || eventType === "EstimateSent"
                ? "sent"
                : "draft";

        const { data: existing } = await supabase
          .from("estimates")
          .select("id")
          .eq("user_id", userId)
          .eq("ghl_invoice_id", ghlEstId)
          .maybeSingle();

        if (existing) {
          const update: Record<string, unknown> = { status };
          if (status === "sent") update.sent_at = new Date().toISOString();
          await supabase.from("estimates").update(update).eq("id", existing.id);
        } else {
          const contactId = pickString(e, ["contactId", "contact_id"]);
          const clientId = await resolveClientId(supabase, userId, contactId);
          if (!clientId) break;
          await supabase.from("estimates").insert({
            user_id: userId,
            client_id: clientId,
            ghl_invoice_id: ghlEstId, // reused column to track the GHL id
            estimate_number:
              pickString(e, ["estimateNumber", "estimate_number", "number"]) ??
              `EST-${ghlEstId.slice(-6)}`,
            line_items: pickArray(e, ["items", "lineItems", "line_items"]),
            total: pickNumber(e, ["amount", "total", "totalAmount"]),
            status,
            sent_at: status === "sent" ? new Date().toISOString() : null,
          });
        }
        break;
      }

      case "appointment.created":
      case "appointment.updated":
      case "AppointmentCreate":
      case "AppointmentUpdate": {
        const a = (payload.appointment ?? payload) as Record<string, unknown>;
        const eventId =
          pickString(a, ["id", "appointment_id", "appointmentId", "_id"]) ?? "";
        if (!eventId) break;
        await supabase.from("appointments").upsert(
          {
            user_id: userId,
            ghl_event_id: eventId,
            title: pickString(a, ["title", "appointment_title"]) ?? "Appointment",
            notes: pickString(a, ["notes", "appointment_notes"]),
            scheduled_at:
              pickString(a, ["startTime", "start_time", "scheduled_at"]) ??
              new Date().toISOString(),
            duration_minutes:
              Number((a.duration as number | string | undefined) ?? 60) || 60,
            assigned_to: pickString(a, ["assignedUserId", "assigned_user_id"]),
            // client_id intentionally omitted on conflict-update so we don't
            // clobber a Smintos-created appointment's client reference.
          },
          { onConflict: "ghl_event_id" },
        );
        break;
      }

      default:
        // Unknown event type — log and acknowledge.
        break;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "sync error";
    console.error("GHL_WEBHOOK_ERROR", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
