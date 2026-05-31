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
} from "@/lib/ghl";
import type { LineItem } from "@/types";

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
