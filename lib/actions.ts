"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceSupabase } from "@/lib/supabase";
import { getCurrentUser, hasGhlCreds } from "@/lib/session";
import { shortNumber } from "@/lib/format";
import {
  createContact,
  createInvoice,
  updateInvoice,
  createCalendarEvent,
  listContacts,
  listInvoices as ghlListInvoices,
  listEstimates as ghlListEstimates,
  sendConversationMessage,
  searchConversations,
  listConversationMessages,
} from "@/lib/ghl";
import type { LineItem } from "@/types";

/**
 * Translate a GHL invoice/estimate line-item into Smintos's LineItem shape.
 * GHL fields vary (name vs description, qty vs quantity, amount vs price, and
 * sometimes a nested price object) — be tolerant.
 */
function mapGhlLineItems(rawItems: unknown): LineItem[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((raw, i) => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const priceObj = r.price as { amount?: number } | undefined;
    const description =
      (r.name as string | undefined) ||
      (r.description as string | undefined) ||
      (r.productName as string | undefined) ||
      "Item";
    return {
      id: String(r._id ?? r.id ?? `imp-${i}`),
      description,
      quantity: Number(r.qty ?? r.quantity ?? 1) || 1,
      unitPrice:
        Number(
          r.amount ??
            r.unitPrice ??
            r.unit_price ??
            priceObj?.amount ??
            (r.price as number | undefined) ??
            0,
        ) || 0,
    };
  });
}

/**
 * Server actions. These run only on the server, so reading GHL credentials and
 * calling the GHL API here never exposes keys to the client (spec rule 1).
 * Every write is scoped to the authenticated user's id (spec rule 2).
 */

// --- Clients --------------------------------------------------------------

export async function createClientAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const city = String(formData.get("city") ?? "").trim() || null;
  const state = String(formData.get("state") ?? "").trim() || null;
  const postalCode = String(formData.get("postal_code") ?? "").trim() || null;
  const country = String(formData.get("country") ?? "").trim() || null;
  if (!name) return;

  let ghlContactId: string | null = null;
  if (hasGhlCreds(user)) {
    const res = await createContact(user.ghl_location_id, user.ghl_api_key, {
      name,
      phone: phone ?? undefined,
      email: email ?? undefined,
      address1: address ?? undefined,
      city: city ?? undefined,
      state: state ?? undefined,
      postalCode: postalCode ?? undefined,
      country: country ?? undefined,
    });
    if (res.ok && res.data?.contact?.id) ghlContactId = res.data.contact.id;
  }

  const supabase = createServiceSupabase();
  await supabase.from("clients").insert({
    user_id: user.id,
    ghl_contact_id: ghlContactId,
    name,
    phone,
    email,
    address,
    city,
    state,
    postal_code: postalCode,
    country,
  });

  revalidatePath("/clients");
  revalidatePath("/");
  redirect("/clients");
}

/**
 * One-click import: pull existing contacts from the connected GHL location into
 * Smintos. Upserts by ghl_contact_id so re-running is safe (no duplicates).
 * Paginates up to a cap to stay within serverless time limits.
 */
export async function importGhlContactsAction(): Promise<{
  imported: number;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { imported: 0, error: "Not signed in." };
  if (!hasGhlCreds(user))
    return { imported: 0, error: "Connect GoHighLevel in Settings first." };

  const supabase = createServiceSupabase();
  let imported = 0;
  let startAfter: number | undefined;
  let startAfterId: string | undefined;
  const PAGE = 100;
  const MAX_PAGES = 25; // safety cap (~2,500 contacts/run)

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await listContacts(user.ghl_location_id, user.ghl_api_key, {
      limit: PAGE,
      startAfter,
      startAfterId,
    });
    if (!res.ok || !res.data) {
      return { imported, error: res.error ?? "Failed to fetch from GoHighLevel." };
    }

    const contacts = res.data.contacts ?? [];
    if (contacts.length === 0) break;

    const rows = contacts.map((c) => {
      const first = (c.firstName as string | undefined) ?? "";
      const last = (c.lastName as string | undefined) ?? "";
      const name =
        (c.contactName as string | undefined) ||
        (c.name as string | undefined) ||
        `${first} ${last}`.trim() ||
        "Unnamed";
      return {
        user_id: user.id,
        ghl_contact_id: String(c.id),
        name,
        phone: (c.phone as string | null) ?? null,
        email: (c.email as string | null) ?? null,
        address: (c.address1 as string | null) ?? null,
        city: (c.city as string | null) ?? null,
        state: (c.state as string | null) ?? null,
        postal_code: (c.postalCode as string | null) ?? null,
        country: (c.country as string | null) ?? null,
      };
    });

    const { error } = await supabase
      .from("clients")
      .upsert(rows, { onConflict: "ghl_contact_id" });
    if (error) return { imported, error: error.message };

    imported += rows.length;

    const meta = res.data.meta;
    if (contacts.length < PAGE || !meta?.startAfterId) break;
    startAfter = meta.startAfter;
    startAfterId = meta.startAfterId;
  }

  revalidatePath("/clients");
  revalidatePath("/");
  return { imported };
}

// --- Estimates ------------------------------------------------------------

export async function createEstimateAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const clientId = String(formData.get("client_id") ?? "");
  const rawItems = String(formData.get("line_items") ?? "[]");
  if (!clientId) return;

  let lineItems: LineItem[] = [];
  try {
    lineItems = JSON.parse(rawItems) as LineItem[];
  } catch {
    lineItems = [];
  }
  const total = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("estimates")
    .insert({
      user_id: user.id,
      client_id: clientId,
      estimate_number: shortNumber("EST"),
      line_items: lineItems,
      total,
      status: "draft",
    })
    .select("id")
    .maybeSingle();

  revalidatePath("/estimates");
  revalidatePath("/");
  if (data?.id) redirect(`/estimates/${data.id}`);
  redirect("/estimates");
}

export async function sendEstimateAction(estimateId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createServiceSupabase();
  await supabase
    .from("estimates")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("id", estimateId);

  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath("/");
}

export async function setEstimateStatusAction(
  estimateId: string,
  status: "approved" | "declined",
) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createServiceSupabase();
  await supabase
    .from("estimates")
    .update({ status })
    .eq("user_id", user.id)
    .eq("id", estimateId);

  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath("/");
}

// --- Estimate -> Invoice conversion --------------------------------------

export async function convertEstimateToInvoiceAction(estimateId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createServiceSupabase();
  const { data: estimate } = await supabase
    .from("estimates")
    .select("*, client:clients(id, name, ghl_contact_id)")
    .eq("user_id", user.id)
    .eq("id", estimateId)
    .maybeSingle();

  if (!estimate) redirect("/estimates");

  const lineItems = (estimate.line_items as LineItem[]) ?? [];
  const total = Number(estimate.total) || 0;

  // Mirror the invoice into GHL when credentials are connected.
  let ghlInvoiceId: string | null = null;
  const ghlContactId = estimate.client?.ghl_contact_id as string | undefined;
  if (hasGhlCreds(user) && ghlContactId) {
    const res = await createInvoice(user.ghl_location_id, user.ghl_api_key, {
      contactId: ghlContactId,
      name: `Invoice for ${estimate.estimate_number}`,
      items: lineItems.map((i) => ({
        name: i.description,
        qty: i.quantity,
        amount: i.unitPrice,
      })),
      total,
    });
    if (res.ok) ghlInvoiceId = res.data?.invoice?.id ?? res.data?.id ?? null;
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      client_id: estimate.client_id,
      estimate_id: estimate.id,
      ghl_invoice_id: ghlInvoiceId,
      invoice_number: shortNumber("INV"),
      line_items: lineItems,
      total,
      status: "sent",
      due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
    })
    .select("id")
    .maybeSingle();

  revalidatePath("/invoices");
  revalidatePath("/estimates");
  revalidatePath("/");
  if (invoice?.id) redirect(`/invoices/${invoice.id}`);
  redirect("/invoices");
}

/**
 * Create an invoice directly (skipping the estimate step). Mirrors the
 * estimate->invoice conversion but takes the line items from the form
 * instead of from a source estimate.
 */
export async function createInvoiceAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const clientId = String(formData.get("client_id") ?? "");
  const rawItems = String(formData.get("line_items") ?? "[]");
  if (!clientId) return;

  let lineItems: LineItem[] = [];
  try {
    lineItems = JSON.parse(rawItems) as LineItem[];
  } catch {
    lineItems = [];
  }
  const total = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);

  // Push the invoice to GHL when credentials are connected and we have a contact id.
  let ghlInvoiceId: string | null = null;
  const supabase = createServiceSupabase();
  const { data: client } = await supabase
    .from("clients")
    .select("ghl_contact_id")
    .eq("user_id", user.id)
    .eq("id", clientId)
    .maybeSingle();

  if (hasGhlCreds(user) && client?.ghl_contact_id) {
    const res = await createInvoice(user.ghl_location_id, user.ghl_api_key, {
      contactId: client.ghl_contact_id,
      name: `Invoice ${shortNumber("INV")}`,
      items: lineItems.map((i) => ({
        name: i.description,
        qty: i.quantity,
        amount: i.unitPrice,
      })),
      total,
    });
    if (res.ok) ghlInvoiceId = res.data?.invoice?.id ?? res.data?.id ?? null;
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      client_id: clientId,
      ghl_invoice_id: ghlInvoiceId,
      invoice_number: shortNumber("INV"),
      line_items: lineItems,
      total,
      status: "sent",
      due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
    })
    .select("id")
    .maybeSingle();

  revalidatePath("/invoices");
  revalidatePath("/library");
  revalidatePath("/");
  if (invoice?.id) redirect(`/invoices/${invoice.id}`);
  redirect("/invoices");
}

// --- Invoices -------------------------------------------------------------

export async function markInvoicePaidAction(invoiceId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createServiceSupabase();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("ghl_invoice_id")
    .eq("user_id", user.id)
    .eq("id", invoiceId)
    .maybeSingle();

  await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("id", invoiceId);

  if (hasGhlCreds(user) && invoice?.ghl_invoice_id) {
    await updateInvoice(
      user.ghl_location_id,
      user.ghl_api_key,
      invoice.ghl_invoice_id,
      { status: "paid" },
    );
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  revalidatePath("/");
}

// --- Appointments ---------------------------------------------------------

export async function createAppointmentAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const clientId = String(formData.get("client_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const scheduledAt = String(formData.get("scheduled_at") ?? "");
  const duration = Number(formData.get("duration_minutes") ?? 60) || 60;
  const assignedTo = String(formData.get("assigned_to") ?? "").trim() || null;
  if (!clientId || !title || !scheduledAt) return;

  const startIso = new Date(scheduledAt).toISOString();
  const endIso = new Date(
    new Date(scheduledAt).getTime() + duration * 60000,
  ).toISOString();

  let ghlEventId: string | null = null;
  if (hasGhlCreds(user)) {
    const supabaseLookup = createServiceSupabase();
    const { data: client } = await supabaseLookup
      .from("clients")
      .select("ghl_contact_id")
      .eq("user_id", user.id)
      .eq("id", clientId)
      .maybeSingle();

    if (client?.ghl_contact_id) {
      const res = await createCalendarEvent(
        user.ghl_location_id,
        user.ghl_api_key,
        {
          contactId: client.ghl_contact_id,
          title,
          startTime: startIso,
          endTime: endIso,
          notes: notes ?? undefined,
        },
      );
      if (res.ok) ghlEventId = res.data?.event?.id ?? res.data?.id ?? null;
    }
  }

  const supabase = createServiceSupabase();
  await supabase.from("appointments").insert({
    user_id: user.id,
    client_id: clientId,
    ghl_event_id: ghlEventId,
    title,
    notes,
    scheduled_at: startIso,
    duration_minutes: duration,
    assigned_to: assignedTo,
  });

  revalidatePath("/schedule");
  revalidatePath("/");
  redirect("/schedule");
}

// --- Messages -------------------------------------------------------------

/**
 * Send an SMS reply through GHL. Records the outbound message locally so the
 * thread updates immediately, even before the optional outbound webhook fires.
 */
export async function sendMessageAction(
  clientId: string,
  body: string,
  channel: "SMS" | "Email" = "SMS",
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!hasGhlCreds(user))
    return { ok: false, error: "Connect GoHighLevel in Settings first." };

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Message is empty." };

  const supabase = createServiceSupabase();
  const { data: client } = await supabase
    .from("clients")
    .select("id, ghl_contact_id")
    .eq("user_id", user.id)
    .eq("id", clientId)
    .maybeSingle();

  if (!client?.ghl_contact_id)
    return { ok: false, error: "Client has no GoHighLevel contact id." };

  const res = await sendConversationMessage(
    user.ghl_location_id,
    user.ghl_api_key,
    { type: channel, contactId: client.ghl_contact_id, message: trimmed },
  );
  if (!res.ok) return { ok: false, error: res.error ?? "Send failed." };

  await supabase.from("messages").insert({
    user_id: user.id,
    client_id: client.id,
    ghl_contact_id: client.ghl_contact_id,
    ghl_conversation_id: res.data?.conversationId ?? null,
    ghl_message_id: res.data?.messageId ?? null,
    direction: "outbound",
    channel,
    body: trimmed,
    status: "sent",
  });

  revalidatePath(`/messages/${client.id}`);
  revalidatePath("/messages");
  return { ok: true };
}

/**
 * Pull existing invoices from GHL into Smintos.
 * Idempotent via the (user_id, ghl_invoice_id) unique constraint.
 */
export async function importGhlInvoicesAction(): Promise<{
  imported: number;
  skipped: number;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { imported: 0, skipped: 0, error: "Not signed in." };
  if (!hasGhlCreds(user))
    return { imported: 0, skipped: 0, error: "Connect GoHighLevel first." };

  const supabase = createServiceSupabase();
  const PAGE = 100;
  const MAX_PAGES = 25;
  let imported = 0;
  let skipped = 0;
  let offset = 0;

  for (let p = 0; p < MAX_PAGES; p++) {
    const res = await ghlListInvoices(user.ghl_location_id, user.ghl_api_key, {
      limit: PAGE,
      offset,
    });
    if (!res.ok || !res.data)
      return { imported, skipped, error: res.error ?? "GHL fetch failed." };

    const items = (res.data.invoices ?? []) as Array<Record<string, unknown>>;
    if (items.length === 0) break;

    const rows: Array<Record<string, unknown>> = [];
    for (const inv of items) {
      const ghlId = String(inv._id ?? inv.id ?? "");
      if (!ghlId) continue;
      const contactId =
        (inv.contactDetails as { id?: string } | undefined)?.id ??
        (inv.contactId as string | undefined) ??
        null;
      const clientId = await resolveClientByGhlId(supabase, user.id, contactId);
      if (!clientId) {
        skipped += 1;
        continue;
      }

      const statusRaw = String(inv.status ?? "sent").toLowerCase();
      const status =
        statusRaw === "paid"
          ? "paid"
          : statusRaw === "overdue"
            ? "overdue"
            : "sent";

      rows.push({
        user_id: user.id,
        client_id: clientId,
        ghl_invoice_id: ghlId,
        invoice_number:
          (inv.invoiceNumber as string | undefined) ??
          (inv.name as string | undefined) ??
          `INV-${ghlId.slice(-6)}`,
        line_items: mapGhlLineItems(
          inv.invoiceItems ?? inv.items ?? inv.lineItems,
        ),
        total: Number(inv.total ?? inv.amount ?? 0) || 0,
        status,
        due_date: (inv.dueDate as string | undefined) ?? null,
        paid_at:
          status === "paid"
            ? ((inv.updatedAt as string | undefined) ??
              new Date().toISOString())
            : null,
      });
    }

    if (rows.length > 0) {
      const { error } = await supabase
        .from("invoices")
        .upsert(rows, { onConflict: "user_id,ghl_invoice_id" });
      if (error) return { imported, skipped, error: error.message };
      imported += rows.length;
    }

    if (items.length < PAGE) break;
    offset += PAGE;
  }

  revalidatePath("/invoices");
  revalidatePath("/library");
  return { imported, skipped };
}

/**
 * Pull existing estimates from GHL into Smintos.
 */
export async function importGhlEstimatesAction(): Promise<{
  imported: number;
  skipped: number;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { imported: 0, skipped: 0, error: "Not signed in." };
  if (!hasGhlCreds(user))
    return { imported: 0, skipped: 0, error: "Connect GoHighLevel first." };

  const supabase = createServiceSupabase();
  const PAGE = 100;
  const MAX_PAGES = 25;
  let imported = 0;
  let skipped = 0;
  let offset = 0;

  for (let p = 0; p < MAX_PAGES; p++) {
    const res = await ghlListEstimates(user.ghl_location_id, user.ghl_api_key, {
      limit: PAGE,
      offset,
    });
    if (!res.ok || !res.data)
      return { imported, skipped, error: res.error ?? "GHL fetch failed." };

    const items =
      ((res.data.estimates ?? res.data.data) as
        | Array<Record<string, unknown>>
        | undefined) ?? [];
    if (items.length === 0) break;

    const rows: Array<Record<string, unknown>> = [];
    for (const e of items) {
      const ghlId = String(e._id ?? e.id ?? "");
      if (!ghlId) continue;
      const contactId =
        (e.contactDetails as { id?: string } | undefined)?.id ??
        (e.contactId as string | undefined) ??
        null;
      const clientId = await resolveClientByGhlId(supabase, user.id, contactId);
      if (!clientId) {
        skipped += 1;
        continue;
      }

      const statusRaw = String(e.status ?? "draft").toLowerCase();
      const status =
        statusRaw === "accepted" || statusRaw === "approved"
          ? "approved"
          : statusRaw === "declined" || statusRaw === "rejected"
            ? "declined"
            : statusRaw === "sent"
              ? "sent"
              : "draft";

      rows.push({
        user_id: user.id,
        client_id: clientId,
        ghl_invoice_id: ghlId,
        estimate_number:
          (e.estimateNumber as string | undefined) ??
          (e.name as string | undefined) ??
          `EST-${ghlId.slice(-6)}`,
        line_items: mapGhlLineItems(e.invoiceItems ?? e.items ?? e.lineItems),
        total: Number(e.total ?? e.amount ?? 0) || 0,
        status,
        sent_at:
          status === "sent" || status === "approved" || status === "declined"
            ? ((e.updatedAt as string | undefined) ?? new Date().toISOString())
            : null,
      });
    }

    if (rows.length > 0) {
      const { error } = await supabase
        .from("estimates")
        .upsert(rows, { onConflict: "user_id,ghl_invoice_id" });
      if (error) return { imported, skipped, error: error.message };
      imported += rows.length;
    }

    if (items.length < PAGE) break;
    offset += PAGE;
  }

  revalidatePath("/estimates");
  revalidatePath("/library");
  return { imported, skipped };
}

async function resolveClientByGhlId(
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

/**
 * One-click historical import: walks GHL conversations and pulls existing
 * messages into Smintos. Capped so we stay within serverless time limits.
 */
export async function importGhlMessagesAction(): Promise<{
  imported: number;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { imported: 0, error: "Not signed in." };
  if (!hasGhlCreds(user))
    return { imported: 0, error: "Connect GoHighLevel first." };

  const supabase = createServiceSupabase();
  const MAX_CONVERSATIONS = 25;
  const MESSAGES_PER_CONVO = 100;

  const convRes = await searchConversations(
    user.ghl_location_id,
    user.ghl_api_key,
    { limit: MAX_CONVERSATIONS },
  );
  if (!convRes.ok || !convRes.data) {
    return { imported: 0, error: convRes.error ?? "GHL fetch failed." };
  }
  const conversations = (convRes.data.conversations ?? []) as Array<
    Record<string, unknown>
  >;

  let imported = 0;
  for (const conv of conversations) {
    const convId = String(conv.id ?? "");
    if (!convId) continue;
    const contactId = (conv.contactId as string | undefined) ?? null;

    let clientId: string | null = null;
    if (contactId) {
      const { data: client } = await supabase
        .from("clients")
        .select("id")
        .eq("user_id", user.id)
        .eq("ghl_contact_id", contactId)
        .maybeSingle();
      clientId = client?.id ?? null;
    }

    const msgRes = await listConversationMessages(
      user.ghl_location_id,
      user.ghl_api_key,
      convId,
      { limit: MESSAGES_PER_CONVO },
    );
    if (!msgRes.ok || !msgRes.data) continue;

    // GHL nests the messages array a few different ways depending on the
    // endpoint version — handle each shape defensively.
    const rawMessages =
      (Array.isArray(msgRes.data.messages) && msgRes.data.messages) ||
      (msgRes.data.messages &&
        typeof msgRes.data.messages === "object" &&
        Array.isArray(
          (msgRes.data.messages as { messages?: unknown[] }).messages,
        ) &&
        (msgRes.data.messages as { messages: Array<Record<string, unknown>> })
          .messages) ||
      [];

    if (rawMessages.length === 0) continue;

    const rows = rawMessages.map((m: Record<string, unknown>) => {
      const dir = String(m.direction ?? "").toLowerCase();
      return {
        user_id: user.id,
        client_id: clientId,
        ghl_contact_id: contactId,
        ghl_conversation_id: convId,
        ghl_message_id: String(m.id ?? m._id ?? "") || null,
        direction: dir === "outbound" ? "outbound" : "inbound",
        channel: (m.type as string | undefined) ?? (m.messageType as string | undefined) ?? "SMS",
        body: (m.body as string | undefined) ?? (m.message as string | undefined) ?? null,
        status: (m.status as string | undefined) ?? null,
        created_at:
          (m.dateAdded as string | undefined) ??
          (m.created_at as string | undefined) ??
          undefined,
      };
    }).filter((r) => r.ghl_message_id);

    if (rows.length > 0) {
      const { error } = await supabase
        .from("messages")
        .upsert(rows, { onConflict: "ghl_message_id" });
      if (!error) imported += rows.length;
    }
  }

  revalidatePath("/messages");
  revalidatePath("/");
  return { imported };
}

// --- Settings -------------------------------------------------------------

export async function updateSettingsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const business_name = String(formData.get("business_name") ?? "").trim() || null;
  const ghl_location_id =
    String(formData.get("ghl_location_id") ?? "").trim() || null;
  const ghl_api_key_raw = String(formData.get("ghl_api_key") ?? "").trim();

  const update: Record<string, string | null> = {
    business_name,
    ghl_location_id,
  };
  // Only overwrite the key if a new value was entered (masked field).
  if (ghl_api_key_raw && !ghl_api_key_raw.startsWith("•")) {
    update.ghl_api_key = ghl_api_key_raw;
  }

  const supabase = createServiceSupabase();
  await supabase.from("users").update(update).eq("id", user.id);

  revalidatePath("/settings");
  revalidatePath("/");
}
