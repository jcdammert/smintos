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
  if (!name) return;

  let ghlContactId: string | null = null;
  if (hasGhlCreds(user)) {
    const res = await createContact(user.ghl_location_id, user.ghl_api_key, {
      name,
      phone: phone ?? undefined,
      email: email ?? undefined,
      address1: address ?? undefined,
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
  });

  revalidatePath("/clients");
  revalidatePath("/");
  redirect("/clients");
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
