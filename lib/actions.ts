"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createServiceSupabase } from "@/lib/supabase";
import { getCurrentUser, hasGhlCreds } from "@/lib/session";
import { shortNumber, stripHtml, toTitleCase } from "@/lib/format";
import {
  createContact,
  updateContact,
  createEstimate as ghlCreateEstimate,
  createEstimateViaInvoice as ghlCreateEstimateViaInvoice,
  sendEstimate as ghlSendEstimate,
  deleteEstimate as ghlDeleteEstimate,
  getLocationUsers,
  createInvoice,
  sendInvoice,
  updateInvoice,
  createCalendarEvent,
  updateCalendarEvent,
  listContacts,
  listInvoices as ghlListInvoices,
  listEstimates as ghlListEstimates,
  listProducts as ghlListProducts,
  createNote as ghlCreateNote,
  listNotes as ghlListNotes,
  deleteNote as ghlDeleteNote,
  sendConversationMessage,
  searchConversations,
  listConversationMessages,
  getCallTranscription,
  getContact,
  getLocationTags,
  addContactTags,
  removeContactTags,
} from "@/lib/ghl";
import type { GhlInvoiceItem, LineItem } from "@/types";

/** Build the complete GHL invoice body — same required fields across invoices and estimates. */
function buildGhlInvoiceBody(opts: {
  contactId: string;
  contactName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  businessName: string;
  invoiceName: string;
  lineItems: LineItem[];
  total: number;
  daysUntilDue?: number;
}) {
  const today = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const due = new Date(Date.now() + (opts.daysUntilDue ?? 14) * 86400000).toISOString().slice(0, 10);
  const phone = opts.contactPhone ?? "";
  const digits = phone.replace(/\D/g, "");
  const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : phone || undefined;
  return {
    contactId: opts.contactId,
    contactDetails: {
      id: opts.contactId,
      name: opts.contactName,
      phoneNo: e164 ?? "+10000000000",
      email: opts.contactEmail ?? `${opts.contactId}@placeholder.com`,
    },
    title: opts.invoiceName,
    name: opts.invoiceName,
    currency: "USD",
    businessDetails: { name: opts.businessName },
    issueDate: today,
    dueDate: due,
    discount: { type: "percentage", value: 0 },
    frequencySettings: { enabled: false },
    items: opts.lineItems.map((i): GhlInvoiceItem => {
      const item: GhlInvoiceItem = {
        type: "one_time",
        name: i.description,
        qty: i.quantity,
        amount: i.unitPrice,
        currency: "USD",
        taxes: [],
      };
      if (i.notes) item.description = i.notes;
      return item;
    }),
    total: opts.total,
  };
}

/**
 * Translate a GHL invoice/estimate line-item into Smintos's LineItem shape.
 * GHL fields vary (name vs description, qty vs quantity, amount vs price, and
 * sometimes a nested price object) — be tolerant.
 */
function mapGhlLineItems(rawItems: unknown): LineItem[] {
  if (!Array.isArray(rawItems)) return [];
  return rawItems
    .map((raw, i) => {
      const r = (raw ?? {}) as Record<string, unknown>;
      const priceObj =
        typeof r.price === "object" && r.price !== null
          ? (r.price as { amount?: number })
          : undefined;

      // Prefer name; fall back to (HTML-stripped) description.
      const nameStr = stripHtml(r.name as string | undefined);
      const descStr = stripHtml(r.description as string | undefined);
      const productName = stripHtml(r.productName as string | undefined);
      const description = nameStr || descStr || productName || "Item";

      const qty = Number(r.qty ?? r.quantity ?? 1) || 1;
      const unitPrice =
        Number(
          r.amount ??
            r.unitPrice ??
            r.unit_price ??
            priceObj?.amount ??
            (typeof r.price === "number" ? r.price : undefined) ??
            // Some GHL items only expose itemTotalAmount with no per-unit price.
            (r.itemTotalAmount !== undefined
              ? Number(r.itemTotalAmount) / qty
              : 0),
        ) || 0;

      return {
        id: String(r._id ?? r.id ?? `imp-${i}`),
        description,
        quantity: qty,
        unitPrice,
      };
    })
    // Filter out totally blank items (no description AND no price).
    .filter((i) => i.description !== "Item" || i.unitPrice > 0);
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

  const firstName    = toTitleCase(String(formData.get("first_name")    ?? ""));
  const lastName     = toTitleCase(String(formData.get("last_name")     ?? ""));
  const businessName = toTitleCase(String(formData.get("business_name") ?? ""));
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const name = fullName || businessName;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const city = toTitleCase(String(formData.get("city") ?? "")) || null;
  const state = String(formData.get("state") ?? "").trim().toUpperCase() || null;
  const postalCode = String(formData.get("postal_code") ?? "").trim() || null;
  const country = String(formData.get("country") ?? "").trim().toUpperCase() || null;
  if (!name) return;

  let ghlContactId: string | null = null;
  if (hasGhlCreds(user)) {
    const res = await createContact(user.ghl_location_id, user.ghl_api_key, {
      name,
      firstName: firstName || undefined,
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
      const name = toTitleCase(
        (c.contactName as string | undefined) ||
        (c.name as string | undefined) ||
        `${first} ${last}`.trim() ||
        "Unnamed",
      );
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
        created_at:
          (c.dateAdded as string | undefined) ??
          (c.createdAt as string | undefined) ??
          (c.dateCreated as string | undefined) ??
          undefined,
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

export async function updateClientAction(
  clientId: string,
  formData: FormData,
) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const firstName    = toTitleCase(String(formData.get("first_name")    ?? ""));
  const lastName     = toTitleCase(String(formData.get("last_name")     ?? ""));
  const businessName = toTitleCase(String(formData.get("business_name") ?? ""));
  const fullName = [firstName, lastName].filter(Boolean).join(" ");
  const name = fullName || businessName;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const email = String(formData.get("email") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const city = toTitleCase(String(formData.get("city") ?? "")) || null;
  const state = String(formData.get("state") ?? "").trim().toUpperCase() || null;
  const postalCode = String(formData.get("postal_code") ?? "").trim() || null;
  const country = String(formData.get("country") ?? "").trim().toUpperCase() || null;
  if (!name) return;

  const supabase = createServiceSupabase();
  await supabase
    .from("clients")
    .update({ name, phone, email, address, city, state, postal_code: postalCode, country })
    .eq("user_id", user.id)
    .eq("id", clientId);

  // Keep GHL in sync if connected.
  if (hasGhlCreds(user)) {
    const { data: client } = await supabase
      .from("clients")
      .select("ghl_contact_id")
      .eq("id", clientId)
      .maybeSingle();
    if (client?.ghl_contact_id) {
      await updateContact(user.ghl_location_id, user.ghl_api_key, client.ghl_contact_id, {
        name,
        firstName: firstName || undefined,
        phone: phone ?? undefined,
        email: email ?? undefined,
        address1: address ?? undefined,
        city: city ?? undefined,
        state: state ?? undefined,
        postalCode: postalCode ?? undefined,
        country: country ?? undefined,
      });
    }
  }

  revalidatePath(`/clients/${clientId}`);
  revalidatePath("/clients");
  redirect(`/clients/${clientId}`);
}

// --- Estimates ------------------------------------------------------------

export async function createEstimateAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const clientId = String(formData.get("client_id") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;
  const rawItems = String(formData.get("line_items") ?? "[]");
  const rawDiscount = String(formData.get("discount") ?? "{}");
  const expiryDate = String(formData.get("expiry_date") ?? "").trim() || null;
  const taxRate = Number(formData.get("tax_rate") ?? 0) || 0;
  const terms = String(formData.get("terms") ?? "").trim() || null;
  const depositAmount = Number(formData.get("deposit_amount") ?? 0) || 0;
  const depositType = String(formData.get("deposit_type") ?? "fixed") as "fixed" | "percent";
  if (!clientId) return;

  let lineItems: LineItem[] = [];
  try { lineItems = JSON.parse(rawItems) as LineItem[]; } catch { lineItems = []; }

  let discountAmount = 0;
  try {
    const d = JSON.parse(rawDiscount) as { type?: string; value?: number };
    if (d.value && d.value > 0) {
      const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      discountAmount = d.type === "percent"
        ? subtotal * (d.value / 100)
        : d.value;
    }
  } catch { /* no discount */ }

  const subtotal = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const taxAmount = taxRate > 0 ? subtotal * (taxRate / 100) : 0;
  const total = Math.max(0, subtotal - discountAmount + taxAmount);

  // Push to GHL as a draft estimate when credentials are connected.
  let ghlEstimateId: string | null = null;
  const supabase = createServiceSupabase();

  // Fetch the full client record so we can populate contactDetails.
  const { data: fullClient } = await supabase
    .from("clients")
    .select("ghl_contact_id, name, phone, email")
    .eq("user_id", user.id)
    .eq("id", clientId)
    .maybeSingle();

  if (hasGhlCreds(user) && fullClient?.ghl_contact_id) {
    const { data: userRecord } = await supabase
      .from("users")
      .select("business_name")
      .eq("id", user.id)
      .maybeSingle();

    const today = new Date(Date.now() - 86400000).toISOString().slice(0, 10); // yesterday — avoids UTC/timezone future-date rejection
    const expiry = expiryDate ?? new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

    // Normalise phone to E.164 (+1XXXXXXXXXX) — GHL rejects other formats.
    const rawPhone = fullClient.phone ?? "";
    const digitsOnly = rawPhone.replace(/\D/g, "");
    const e164Phone = digitsOnly.length === 10
      ? `+1${digitsOnly}`
      : digitsOnly.length === 11 && digitsOnly.startsWith("1")
        ? `+${digitsOnly}`
        : rawPhone || "+10000000000";

    const estimateName = name ?? `Estimate ${shortNumber("EST")}`;
    const estimatePayload = {
      contactId: fullClient.ghl_contact_id,
      contactDetails: {
        id: fullClient.ghl_contact_id,
        name: fullClient.name ?? "Client",
        phoneNo: e164Phone,
        email: fullClient.email ?? `${fullClient.ghl_contact_id}@placeholder.com`,
      },
      // GHL requires both `title` AND `name`.
      title: estimateName,
      name: estimateName,
      // Set the EST- prefix so GHL doesn't default to "undefined<seq>"
      invoiceNumber: { prefix: "EST-" },
      currency: "USD",
      businessDetails: { name: userRecord?.business_name ?? "My Business" },
      issueDate: today,
      expiryDate: expiry,
      discount: { type: "percentage", value: 0 },
      frequencySettings: { enabled: false },
      ...(terms ? { terms } : {}),
      ...(depositAmount > 0 ? {
        paymentSchedule: {
          enabled: true,
          schedules: [
            {
              name: "Deposit",
              amount: depositType === "percent"
                ? Math.round(total * (depositAmount / 100) * 100) / 100
                : depositAmount,
              dueDate: today,
            },
          ],
        },
      } : {}),
      items: lineItems.map((i): GhlInvoiceItem => {
        const item: GhlInvoiceItem = {
          type: "one_time",
          name: i.description,
          qty: i.quantity,
          amount: i.unitPrice,
          currency: "USD",
          taxes: taxRate > 0 ? [{ rate: taxRate, name: "Tax", description: `${taxRate}%` }] : [],
        };
        if (i.notes) item.description = i.notes;
        return item;
      }),
      total,
    };

    let res = await ghlCreateEstimate(
      user.ghl_location_id,
      user.ghl_api_key,
      estimatePayload,
    );

    // If the dedicated estimate endpoint doesn't exist on this account (404),
    // fall back to creating a draft invoice which GHL treats as an estimate.
    if (!res.ok && (res.status === 404 || res.status === 405)) {
      res = await ghlCreateEstimateViaInvoice(
        user.ghl_location_id,
        user.ghl_api_key,
        estimatePayload,
      );
    }


    if (res.ok) {
      const d = res.data as Record<string, unknown> | null;
      // Try every field name GHL might use for the estimate ID.
      ghlEstimateId =
        (d?.estimateId as string | undefined) ??
        (d?._id as string | undefined) ??
        (d?.id as string | undefined) ??
        ((d?.estimate as Record<string, unknown> | undefined)?._id as string | undefined) ??
        ((d?.estimate as Record<string, unknown> | undefined)?.id as string | undefined) ??
        res.data?.invoice?.id ??
        null;
    }
  }

  const { data, error: insertError } = await supabase
    .from("estimates")
    .insert({
      user_id: user.id,
      client_id: clientId,
      ghl_invoice_id: ghlEstimateId,
      estimate_number: shortNumber("EST"),
      name,
      line_items: lineItems,
      total,
      status: "draft",
      expires_at: expiryDate ? new Date(expiryDate + "T00:00:00").toISOString() : null,
      tax_rate: taxRate > 0 ? taxRate : null,
      deposit_amount: depositAmount > 0 ? depositAmount : null,
      deposit_type: depositAmount > 0 ? depositType : null,
      terms: terms || null,
    })
    .select("id, ghl_invoice_id")
    .maybeSingle();

  // Verify the ghl_invoice_id actually landed in the DB.
  console.log("ESTIMATE_INSERT", {
    insertError: insertError?.message ?? null,
    savedId: data?.id ?? null,
    savedGhlId: (data as Record<string, unknown> | null)?.ghl_invoice_id ?? null,
    intendedGhlId: ghlEstimateId,
  });

  revalidatePath("/estimates");
  revalidatePath("/");
  if (data?.id) redirect(`/estimates/${data.id}`);
  redirect("/estimates");
}

export async function updateEstimateAction(
  estimateId: string,
  formData: FormData,
) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim() || null;
  const rawItems = String(formData.get("line_items") ?? "[]");
  const rawDiscount = String(formData.get("discount") ?? "{}");

  let lineItems: LineItem[] = [];
  try { lineItems = JSON.parse(rawItems) as LineItem[]; } catch { lineItems = []; }

  let discountAmount = 0;
  try {
    const d = JSON.parse(rawDiscount) as { type?: string; value?: number };
    if (d.value && d.value > 0) {
      const sub = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      discountAmount = d.type === "percent" ? sub * (d.value / 100) : d.value;
    }
  } catch { /* no discount */ }
  const total = Math.max(0, lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0) - discountAmount);

  const supabase = createServiceSupabase();
  await supabase
    .from("estimates")
    .update({ name, line_items: lineItems, total })
    .eq("user_id", user.id)
    .eq("id", estimateId);

  // Sync line item changes to GHL if we have a GHL estimate id.
  const { data: est } = await supabase
    .from("estimates")
    .select("ghl_invoice_id")
    .eq("id", estimateId)
    .maybeSingle();

  if (hasGhlCreds(user) && est?.ghl_invoice_id) {
    await updateInvoice(user.ghl_location_id, user.ghl_api_key, est.ghl_invoice_id, {
      name: name ?? undefined,
      items: lineItems.map((i) => ({
        name: i.description,
        description: i.notes ?? undefined,
        qty: i.quantity,
        amount: i.unitPrice,
      })),
      total,
    });
  }

  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath("/estimates");
  redirect(`/estimates/${estimateId}`);
}

export async function updateInvoiceDetailsAction(
  invoiceId: string,
  formData: FormData,
) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim() || null;
  const rawItems = String(formData.get("line_items") ?? "[]");
  const rawDiscount = String(formData.get("discount") ?? "{}");

  let lineItems: LineItem[] = [];
  try { lineItems = JSON.parse(rawItems) as LineItem[]; } catch { lineItems = []; }

  let discountAmount = 0;
  try {
    const d = JSON.parse(rawDiscount) as { type?: string; value?: number };
    if (d.value && d.value > 0) {
      const sub = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      discountAmount = d.type === "percent" ? sub * (d.value / 100) : d.value;
    }
  } catch { /* no discount */ }
  const total = Math.max(0, lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0) - discountAmount);

  const supabase = createServiceSupabase();
  await supabase
    .from("invoices")
    .update({ name, line_items: lineItems, total })
    .eq("user_id", user.id)
    .eq("id", invoiceId);

  const { data: inv } = await supabase
    .from("invoices")
    .select("ghl_invoice_id")
    .eq("id", invoiceId)
    .maybeSingle();

  if (hasGhlCreds(user) && inv?.ghl_invoice_id) {
    await updateInvoice(user.ghl_location_id, user.ghl_api_key, inv.ghl_invoice_id, {
      name: name ?? undefined,
      items: lineItems.map((i) => ({
        name: i.description,
        description: i.notes ?? undefined,
        qty: i.quantity,
        amount: i.unitPrice,
      })),
      total,
    });
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  redirect(`/invoices/${invoiceId}`);
}

export async function deleteEstimateAction(estimateId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createServiceSupabase();

  // Fetch GHL id before deleting so we can remove it from GHL too.
  const { data: est } = await supabase
    .from("estimates")
    .select("ghl_invoice_id")
    .eq("user_id", user.id)
    .eq("id", estimateId)
    .maybeSingle();

  await supabase
    .from("estimates")
    .delete()
    .eq("user_id", user.id)
    .eq("id", estimateId);

  // Mirror the delete to GHL.
  console.log("DELETE_ESTIMATE ghl_invoice_id=", est?.ghl_invoice_id, "hasCreds=", hasGhlCreds(user));
  if (hasGhlCreds(user) && est?.ghl_invoice_id) {
    const delRes = await ghlDeleteEstimate(user.ghl_location_id, user.ghl_api_key, est.ghl_invoice_id);
    console.log("DELETE_ESTIMATE result=", JSON.stringify({ ok: delRes.ok, status: delRes.status, error: delRes.error }));
  }

  revalidatePath("/estimates");
  revalidatePath("/library");
  revalidatePath("/");
  redirect("/estimates");
}

export async function deleteInvoiceAction(invoiceId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createServiceSupabase();
  const { data: inv } = await supabase
    .from("invoices")
    .select("ghl_invoice_id")
    .eq("user_id", user.id)
    .eq("id", invoiceId)
    .maybeSingle();

  await supabase
    .from("invoices")
    .delete()
    .eq("user_id", user.id)
    .eq("id", invoiceId);

  // Mirror the delete to GHL.
  if (hasGhlCreds(user) && inv?.ghl_invoice_id) {
    await updateInvoice(user.ghl_location_id, user.ghl_api_key, inv.ghl_invoice_id, {
      status: "cancelled",
    });
  }

  revalidatePath("/invoices");
  revalidatePath("/library");
  revalidatePath("/");
  redirect("/invoices");
}

export async function sendEstimateAction(estimateId: string, channel: "email" | "sms" | "sms_and_email" = "sms_and_email") {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createServiceSupabase();
  const { data: estimate } = await supabase
    .from("estimates")
    .select("*, client:clients(id, name, email, phone, ghl_contact_id)")
    .eq("user_id", user.id)
    .eq("id", estimateId)
    .maybeSingle();

  if (!estimate) return;

  let ghlId = estimate.ghl_invoice_id as string | null;
  const client0 = estimate.client as Record<string, unknown> | null;
  console.log("SEND_ESTIMATE debug=", JSON.stringify({
    ghlId,
    clientEmail: client0?.email,
    clientPhone: client0?.phone,
    clientName: client0?.name,
  }));

  if (hasGhlCreds(user)) {
    const contact = estimate.client as { ghl_contact_id?: string | null } | null;

    // If not yet in GHL, push it first.
    if (!ghlId && contact?.ghl_contact_id) {
      const lineItems = (estimate.line_items as LineItem[]) ?? [];
      const { data: userRecord } = await supabase
        .from("users")
        .select("business_name")
        .eq("id", user.id)
        .maybeSingle();
      const today2 = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const expiry2 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
      const estName2 = (estimate.name as string | null) ?? estimate.estimate_number;
      const c2 = contact as Record<string, unknown>;
      const phone2 = (c2.phone as string | undefined) ?? "";
      const digits2 = phone2.replace(/\D/g, "");
      const e164b = digits2.length === 10 ? `+1${digits2}` : digits2.length === 11 && digits2.startsWith("1") ? `+${digits2}` : phone2 || "+10000000000";
      const res = await ghlCreateEstimate(user.ghl_location_id, user.ghl_api_key, {
        contactId: contact.ghl_contact_id,
        contactDetails: {
          id: contact.ghl_contact_id,
          name: (c2.name as string | undefined) ?? "Client",
          phoneNo: e164b,
          email: (c2.email as string | undefined) ?? `${contact.ghl_contact_id}@placeholder.com`,
        },
        title: estName2,
        name: estName2,
        currency: "USD",
        businessDetails: { name: userRecord?.business_name ?? "My Business" },
        issueDate: today2,
        expiryDate: expiry2,
        discount: { type: "percentage", value: 0 },
        frequencySettings: { enabled: false },
        items: lineItems.map((i): GhlInvoiceItem => {
          const item: GhlInvoiceItem = {
            type: "one_time",
            name: i.description, qty: i.quantity, amount: i.unitPrice,
            currency: "USD", taxes: [],
          };
          if (i.notes) item.description = i.notes;
          return item;
        }),
        total: Number(estimate.total) || 0,
      });
      if (res.ok) {
        ghlId = res.data?.invoice?.id ?? res.data?.id ?? null;
        if (ghlId) {
          await supabase
            .from("estimates")
            .update({ ghl_invoice_id: ghlId })
            .eq("id", estimateId);
        }
      }
    }

    // Now send via GHL using the exact body shape from the GHL UI network intercept.
    if (ghlId) {
      const client2 = estimate.client as Record<string, unknown> | null;
      const clientEmail = (client2?.email as string | undefined)?.trim();

      if (!clientEmail) {
        // Can't send without a valid email — update status locally but skip GHL send.
        console.log("SEND_ESTIMATE skipped — client has no email address");
      } else {
        const { data: userRec } = await supabase
          .from("users")
          .select("business_name, email")
          .eq("id", user.id)
          .maybeSingle();

        // Normalise phone to E.164 for sentTo.
        const rawPhone = (client2?.phone as string | undefined) ?? "";
        const digits = rawPhone.replace(/\D/g, "");
        const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : rawPhone || undefined;

        // Fetch the GHL userId — required by the send endpoint.
        const usersRes = await getLocationUsers(user.ghl_location_id, user.ghl_api_key);
        const ghlUserId = usersRes.data?.users?.[0]?.id ?? undefined;
        console.log("SEND_ESTIMATE ghlUserId=", ghlUserId);

        const sendRes = await ghlSendEstimate(
          user.ghl_location_id,
          user.ghl_api_key,
          ghlId,
          {
            estimateName: (estimate.name as string | null) ?? (estimate.estimate_number as string),
            fromName: userRec?.business_name ?? "Smintos",
            fromEmail: userRec?.email ?? user.email ?? "",
            toEmail: clientEmail,
            toPhone: e164,
            userId: ghlUserId,
            channel,
          },
        );
        console.log("SEND_ESTIMATE result=", JSON.stringify({ ok: sendRes.ok, status: sendRes.status, error: sendRes.error }));
      }
    } else {
      console.log("SEND_ESTIMATE skipped — no ghlId available");
    }
  }

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
  status: "draft" | "sent" | "approved" | "declined" | "invoiced",
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

export async function convertEstimateToInvoiceAction(estimateId: string, appointmentId?: string | null) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createServiceSupabase();
  const { data: estimate } = await supabase
    .from("estimates")
    .select("*, client:clients(id, name, email, phone, ghl_contact_id)")
    .eq("user_id", user.id)
    .eq("id", estimateId)
    .maybeSingle();

  if (!estimate) redirect("/estimates");

  const lineItems = (estimate.line_items as LineItem[]) ?? [];
  const total = Number(estimate.total) || 0;

  let ghlInvoiceId: string | null = null;
  const ghlContactId = estimate.client?.ghl_contact_id as string | undefined;
  if (hasGhlCreds(user) && ghlContactId) {
    const { data: userRec0 } = await supabase.from("users").select("business_name").eq("id", user.id).maybeSingle();
    const c0 = estimate.client as Record<string, unknown> | null;
    const invName = `Invoice for ${(estimate.name as string | null) ?? estimate.estimate_number}`;
    const res = await createInvoice(user.ghl_location_id, user.ghl_api_key,
      buildGhlInvoiceBody({
        contactId: ghlContactId,
        contactName: (c0?.name as string | undefined) ?? "Client",
        contactPhone: (c0?.phone as string | null) ?? null,
        contactEmail: (c0?.email as string | null) ?? null,
        businessName: userRec0?.business_name ?? "My Business",
        invoiceName: invName,
        lineItems,
        total,
      }),
    );
    if (res.ok) {
      const d = res.data as Record<string, unknown> | null;
      ghlInvoiceId = (d?.invoiceId as string | undefined) ?? (d?._id as string | undefined) ?? (d?.id as string | undefined) ?? res.data?.invoice?.id ?? null;
    }
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      client_id: estimate.client_id,
      estimate_id: estimate.id,
      appointment_id: appointmentId ?? null,
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
  revalidatePath("/calendar");
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
  const name = String(formData.get("name") ?? "").trim() || null;
  const rawItems = String(formData.get("line_items") ?? "[]");
  const rawDiscount = String(formData.get("discount") ?? "{}");
  if (!clientId) return;

  let lineItems: LineItem[] = [];
  try { lineItems = JSON.parse(rawItems) as LineItem[]; } catch { lineItems = []; }

  let discountAmount = 0;
  try {
    const d = JSON.parse(rawDiscount) as { type?: string; value?: number };
    if (d.value && d.value > 0) {
      const sub = lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
      discountAmount = d.type === "percent" ? sub * (d.value / 100) : d.value;
    }
  } catch { /* no discount */ }

  const total = Math.max(
    0,
    lineItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0) - discountAmount,
  );

  // Push the invoice to GHL when credentials are connected and we have a contact id.
  let ghlInvoiceId: string | null = null;
  const supabase = createServiceSupabase();
  const { data: client } = await supabase
    .from("clients")
    .select("ghl_contact_id")
    .eq("user_id", user.id)
    .eq("id", clientId)
    .maybeSingle();

  const { data: fullClient2 } = await supabase
    .from("clients")
    .select("ghl_contact_id, name, phone, email")
    .eq("user_id", user.id)
    .eq("id", clientId)
    .maybeSingle();

  if (hasGhlCreds(user) && fullClient2?.ghl_contact_id) {
    const { data: userRec2 } = await supabase.from("users").select("business_name").eq("id", user.id).maybeSingle();
    const invName2 = name ?? `Invoice ${shortNumber("INV")}`;
    const res = await createInvoice(user.ghl_location_id, user.ghl_api_key,
      buildGhlInvoiceBody({
        contactId: fullClient2.ghl_contact_id,
        contactName: fullClient2.name ?? "Client",
        contactPhone: fullClient2.phone,
        contactEmail: fullClient2.email,
        businessName: userRec2?.business_name ?? "My Business",
        invoiceName: invName2,
        lineItems,
        total,
      }),
    );
    if (res.ok) {
      const d = res.data as Record<string, unknown> | null;
      ghlInvoiceId = (d?.invoiceId as string | undefined) ?? (d?._id as string | undefined) ?? (d?.id as string | undefined) ?? res.data?.invoice?.id ?? null;
    }
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      client_id: clientId,
      ghl_invoice_id: ghlInvoiceId,
      invoice_number: shortNumber("INV"),
      name,
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

export async function sendInvoiceAction(invoiceId: string, channel: "email" | "sms" | "sms_and_email" = "sms_and_email") {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createServiceSupabase();
  const { data: invoice } = await supabase
    .from("invoices")
    .select("*, client:clients(id, name, email, phone, ghl_contact_id)")
    .eq("user_id", user.id)
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) return;

  if (hasGhlCreds(user)) {
    let ghlId = invoice.ghl_invoice_id as string | null;

    // If not yet in GHL, create it first.
    if (!ghlId) {
      const c = invoice.client as Record<string, unknown> | null;
      const contactId = c?.ghl_contact_id as string | undefined;
      if (contactId) {
        const { data: userRec } = await supabase.from("users").select("business_name").eq("id", user.id).maybeSingle();
        const res = await createInvoice(user.ghl_location_id, user.ghl_api_key,
          buildGhlInvoiceBody({
            contactId,
            contactName: (c?.name as string | undefined) ?? "Client",
            contactPhone: (c?.phone as string | null) ?? null,
            contactEmail: (c?.email as string | null) ?? null,
            businessName: userRec?.business_name ?? "My Business",
            invoiceName: (invoice.name as string | null) ?? invoice.invoice_number,
            lineItems: (invoice.line_items as LineItem[]) ?? [],
            total: Number(invoice.total) || 0,
          }),
        );
        if (res.ok) {
          const d = res.data as Record<string, unknown> | null;
          ghlId = (d?.invoiceId as string | undefined) ?? (d?._id as string | undefined) ?? (d?.id as string | undefined) ?? null;
          if (ghlId) await supabase.from("invoices").update({ ghl_invoice_id: ghlId }).eq("id", invoiceId);
        }
      }
    }

    if (ghlId) {
      const c = invoice.client as Record<string, unknown> | null;
      const clientEmail = (c?.email as string | undefined)?.trim();
      if (clientEmail) {
        const { data: userRec } = await supabase.from("users").select("business_name, email").eq("id", user.id).maybeSingle();
        const usersRes = await getLocationUsers(user.ghl_location_id, user.ghl_api_key);
        const ghlUserId = usersRes.data?.users?.[0]?.id ?? undefined;
        await sendInvoice(user.ghl_location_id, user.ghl_api_key, ghlId, {
          invoiceName: (invoice.name as string | null) ?? invoice.invoice_number,
          fromName: userRec?.business_name ?? "Smintos",
          fromEmail: userRec?.email ?? user.email ?? "",
          toEmail: clientEmail,
          toPhone: (c?.phone as string | undefined),
          userId: ghlUserId,
          action: channel,
        });
      }
    }
  }

  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/");
}

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

// --- Estimate → Appointment conversion ------------------------------------

export async function convertEstimateToAppointmentAction(estimateId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createServiceSupabase();
  const { data: estimate } = await supabase
    .from("estimates")
    .select("*, client:clients(id, name, address, ghl_contact_id)")
    .eq("user_id", user.id)
    .eq("id", estimateId)
    .maybeSingle();

  if (!estimate) redirect("/estimates");

  const client = estimate.client as { id: string; name: string; address: string | null; ghl_contact_id: string | null } | null;
  const title = (estimate.name as string | null) ?? (estimate.estimate_number as string);
  const contactName = client?.name ?? null;
  const contactId = client?.ghl_contact_id ?? null;
  const address = client?.address ?? null;
  const jobType = (estimate.name as string | null) ?? null;

  // Default: tomorrow 9 am – 10 am local (server) time
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  const startIso = tomorrow.toISOString();
  const endIso = new Date(tomorrow.getTime() + 3600000).toISOString();

  let ghlEventId: string | null = null;
  if (hasGhlCreds(user) && contactId) {
    const res = await createCalendarEvent(user.ghl_location_id!, user.ghl_api_key!, {
      contactId,
      title: title || "Appointment",
      startTime: startIso,
      endTime: endIso,
    });
    if (res.ok) ghlEventId = res.data?.event?.id ?? res.data?.id ?? null;
  }

  const { data: apt } = await supabase
    .from("appointments")
    .insert({
      user_id: user.id,
      estimate_id: estimateId,
      title,
      contact_name: contactName,
      contact_id: contactId,
      address,
      job_type: jobType,
      start_time: startIso,
      end_time: endIso,
      status: "confirmed",
      ghl_event_id: ghlEventId,
    })
    .select("id")
    .maybeSingle();

  revalidatePath("/calendar");
  revalidatePath(`/estimates/${estimateId}`);
  revalidatePath("/");

  if (apt?.id) redirect(`/calendar?job=${apt.id}`);
  redirect("/calendar");
}

// --- Appointment → Invoice conversion -------------------------------------

export async function convertAppointmentToInvoiceAction(appointmentId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createServiceSupabase();
  const { data: apt } = await supabase
    .from("appointments")
    .select("*")
    .eq("user_id", user.id)
    .eq("id", appointmentId)
    .maybeSingle();

  if (!apt) redirect("/calendar");

  let lineItems: LineItem[] = [];
  let total = 0;
  let clientId: string | null = null;
  const estimateId: string | null = apt.estimate_id ?? null;

  if (estimateId) {
    const { data: est } = await supabase
      .from("estimates")
      .select("client_id, line_items, total")
      .eq("user_id", user.id)
      .eq("id", estimateId)
      .maybeSingle();
    if (est) {
      lineItems = (est.line_items as LineItem[]) ?? [];
      total = Number(est.total) || 0;
      clientId = est.client_id ?? null;
    }
  }

  if (!clientId && apt.contact_id) {
    const { data: cl } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .eq("ghl_contact_id", apt.contact_id)
      .maybeSingle();
    clientId = cl?.id ?? null;
  }

  if (!clientId) redirect(`/appointments/${appointmentId}`);

  const invName = (apt.title as string | null) ?? (apt.contact_name ? `Invoice for ${apt.contact_name as string}` : "Invoice");

  let ghlInvoiceId: string | null = null;
  const { data: fullClient } = await supabase
    .from("clients")
    .select("ghl_contact_id, name, phone, email")
    .eq("user_id", user.id)
    .eq("id", clientId)
    .maybeSingle();

  if (hasGhlCreds(user) && fullClient?.ghl_contact_id) {
    const { data: userRec } = await supabase
      .from("users")
      .select("business_name")
      .eq("id", user.id)
      .maybeSingle();
    const res = await createInvoice(
      user.ghl_location_id,
      user.ghl_api_key,
      buildGhlInvoiceBody({
        contactId: fullClient.ghl_contact_id,
        contactName: fullClient.name ?? "Client",
        contactPhone: fullClient.phone,
        contactEmail: fullClient.email,
        businessName: userRec?.business_name ?? "My Business",
        invoiceName: invName,
        lineItems,
        total,
      }),
    );
    if (res.ok) {
      const d = res.data as Record<string, unknown> | null;
      ghlInvoiceId =
        (d?.invoiceId as string | undefined) ??
        (d?._id as string | undefined) ??
        (d?.id as string | undefined) ??
        null;
    }
  }

  const { data: inv } = await supabase
    .from("invoices")
    .insert({
      user_id: user.id,
      client_id: clientId,
      estimate_id: estimateId,
      appointment_id: appointmentId,
      ghl_invoice_id: ghlInvoiceId,
      invoice_number: shortNumber("INV"),
      name: invName,
      line_items: lineItems,
      total,
      status: "sent",
      due_date: new Date(Date.now() + 14 * 86400000).toISOString(),
    })
    .select("id")
    .maybeSingle();

  revalidatePath("/invoices");
  revalidatePath(`/appointments/${appointmentId}`);
  revalidatePath("/calendar");
  revalidatePath("/");

  if (inv?.id) redirect(`/invoices/${inv.id}`);
  redirect("/invoices");
}

/** Fetch estimate + invoice links for an appointment — used in the calendar detail sheet. */
export async function fetchAppointmentLinksAction(
  aptId: string,
  estimateId: string | null,
  ghlContactId: string | null,
): Promise<{
  estimate: { id: string; estimate_number: string; name: string | null; total: number } | null;
  invoice: { id: string; invoice_number: string; name: string | null; total: number; status: string } | null;
  clientId: string | null;
}> {
  const user = await getCurrentUser();
  if (!user) return { estimate: null, invoice: null, clientId: null };

  const supabase = createServiceSupabase();
  const [estRes, invRes, clientRes] = await Promise.all([
    estimateId
      ? supabase
          .from("estimates")
          .select("id, estimate_number, name, total")
          .eq("user_id", user.id)
          .eq("id", estimateId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("invoices")
      .select("id, invoice_number, name, total, status")
      .eq("user_id", user.id)
      .eq("appointment_id", aptId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    ghlContactId
      ? supabase
          .from("clients")
          .select("id")
          .eq("user_id", user.id)
          .eq("ghl_contact_id", ghlContactId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return {
    estimate: (estRes.data ?? null) as { id: string; estimate_number: string; name: string | null; total: number } | null,
    invoice: (invRes.data ?? null) as { id: string; invoice_number: string; name: string | null; total: number; status: string } | null,
    clientId: (clientRes.data as { id: string } | null)?.id ?? null,
  };
}

// --- Appointments ---------------------------------------------------------

export async function createCalendarAppointmentAction(
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  let title = String(formData.get("title") ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim() || null;
  const contactId   = String(formData.get("contact_id")   ?? "").trim() || null;
  const estimateId  = String(formData.get("estimate_id")  ?? "").trim() || null;
  const jobType     = String(formData.get("job_type")     ?? "").trim() || null;
  const address     = String(formData.get("address")      ?? "").trim() || null;
  const startTime   = String(formData.get("start_time")   ?? "");
  const endTime     = String(formData.get("end_time")     ?? "");
  const assignedTo  = String(formData.get("assigned_to")  ?? "").trim() || null;
  const notes       = String(formData.get("notes")        ?? "").trim() || null;

  if (!startTime || !endTime) {
    return { ok: false, error: "Start time and end time are required." };
  }
  // Fall back to contact name or job type as the display title
  if (!title) title = contactName || jobType || "Appointment";

  const startIso = new Date(startTime).toISOString();
  const endIso = new Date(endTime).toISOString();

  let ghlEventId: string | null = null;

  if (hasGhlCreds(user) && contactId) {
    const res = await createCalendarEvent(
      user.ghl_location_id!,
      user.ghl_api_key!,
      {
        contactId,
        title: title || "Appointment",
        startTime: startIso,
        endTime: endIso,
        notes: notes ?? undefined,
        assignedUserId: undefined,
      },
    );
    if (res.ok) ghlEventId = res.data?.event?.id ?? res.data?.id ?? null;
  }

  const supabase = createServiceSupabase();
  const { error } = await supabase.from("appointments").insert({
    user_id: user.id,
    estimate_id: estimateId,
    title,
    start_time: startIso,
    end_time: endIso,
    status: "confirmed",
    contact_id: contactId,
    contact_name: contactName,
    job_type: jobType,
    address,
    assigned_to: assignedTo,
    notes,
    ghl_event_id: ghlEventId,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/calendar");
  revalidatePath("/");
  return { ok: true };
}

export async function deleteAppointmentAction(appointmentId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createServiceSupabase();

  const { data: apt } = await supabase
    .from("appointments")
    .select("ghl_event_id")
    .eq("user_id", user.id)
    .eq("id", appointmentId)
    .maybeSingle();

  await supabase
    .from("appointments")
    .delete()
    .eq("user_id", user.id)
    .eq("id", appointmentId);

  if (hasGhlCreds(user) && apt?.ghl_event_id) {
    const { deleteCalendarEvent } = await import("@/lib/ghl");
    await deleteCalendarEvent(user.ghl_location_id!, user.ghl_api_key!, apt.ghl_event_id);
  }

  revalidatePath("/calendar");
  revalidatePath("/");
  redirect("/calendar");
}

export async function updateAppointmentAction(
  appointmentId: string,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  let title       = String(formData.get("title")        ?? "").trim();
  const contactName = String(formData.get("contact_name") ?? "").trim() || null;
  const jobType     = String(formData.get("job_type")     ?? "").trim() || null;
  const address     = String(formData.get("address")      ?? "").trim() || null;
  const startTime   = String(formData.get("start_time")   ?? "");
  const endTime     = String(formData.get("end_time")     ?? "");
  const status      = String(formData.get("status")       ?? "unconfirmed");
  const assignedTo  = String(formData.get("assigned_to")  ?? "").trim() || null;
  const notes       = String(formData.get("notes")        ?? "").trim() || null;

  if (!startTime || !endTime) return { ok: false, error: "Start and end times are required." };
  if (!title) title = contactName || jobType || "Appointment";

  const startIso = new Date(startTime).toISOString();
  const endIso   = new Date(endTime).toISOString();

  const supabase = createServiceSupabase();

  const { data: existing } = await supabase
    .from("appointments")
    .select("ghl_event_id")
    .eq("user_id", user.id)
    .eq("id", appointmentId)
    .maybeSingle();

  if (!existing) return { ok: false, error: "Appointment not found." };

  const { error } = await supabase
    .from("appointments")
    .update({ title, contact_name: contactName, job_type: jobType, address, start_time: startIso, end_time: endIso, status, assigned_to: assignedTo, notes })
    .eq("user_id", user.id)
    .eq("id", appointmentId);

  if (error) return { ok: false, error: error.message };

  if (hasGhlCreds(user) && existing.ghl_event_id) {
    await updateCalendarEvent(user.ghl_location_id!, user.ghl_api_key!, existing.ghl_event_id, {
      title: title || "Appointment",
      startTime: startIso,
      endTime: endIso,
      notes: notes ?? undefined,
    });
  }

  revalidatePath(`/appointments/${appointmentId}`);
  revalidatePath("/calendar");
  revalidatePath("/");
  return { ok: true };
}

/** Server action: fetch appointments for a date range — called by the calendar client. */
export async function fetchCalendarRangeAction(
  from: string,
  to: string,
): Promise<import("@/types").Appointment[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const { getCalendarAppointments } = await import("@/lib/data");
  return getCalendarAppointments(user.id, from, to);
}

// --- Notes ----------------------------------------------------------------

export async function createNoteAction(
  clientId: string,
  body: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const trimmed = body.trim();
  if (!trimmed) return { ok: false, error: "Note is empty." };

  const supabase = createServiceSupabase();

  // Get the client's GHL contact id for syncing.
  const { data: client } = await supabase
    .from("clients")
    .select("ghl_contact_id")
    .eq("user_id", user.id)
    .eq("id", clientId)
    .maybeSingle();

  let ghlNoteId: string | null = null;
  if (hasGhlCreds(user) && client?.ghl_contact_id) {
    const res = await ghlCreateNote(
      user.ghl_location_id,
      user.ghl_api_key,
      client.ghl_contact_id,
      { body: trimmed },
    );
    if (res.ok) {
      ghlNoteId = res.data?.note?.id ?? res.data?.id ?? null;
    }
  }

  await supabase.from("notes").insert({
    user_id: user.id,
    client_id: clientId,
    ghl_note_id: ghlNoteId,
    body: trimmed,
  });

  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function deleteNoteAction(
  noteId: string,
  clientId: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const supabase = createServiceSupabase();
  const { data: note } = await supabase
    .from("notes")
    .select("ghl_note_id")
    .eq("user_id", user.id)
    .eq("id", noteId)
    .maybeSingle();

  await supabase
    .from("notes")
    .delete()
    .eq("user_id", user.id)
    .eq("id", noteId);

  // Also delete from GHL if we have the note id and a contact to target.
  if (hasGhlCreds(user) && note?.ghl_note_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("ghl_contact_id")
      .eq("user_id", user.id)
      .eq("id", clientId)
      .maybeSingle();
    if (client?.ghl_contact_id) {
      await ghlDeleteNote(
        user.ghl_location_id,
        user.ghl_api_key,
        client.ghl_contact_id,
        note.ghl_note_id,
      );
    }
  }

  revalidatePath(`/clients/${clientId}`);
  return { ok: true };
}

export async function importGhlNotesAction(
  clientId: string,
): Promise<{ imported: number; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { imported: 0, error: "Not signed in." };
  if (!hasGhlCreds(user))
    return { imported: 0, error: "Connect GoHighLevel first." };

  const supabase = createServiceSupabase();
  const { data: client } = await supabase
    .from("clients")
    .select("ghl_contact_id")
    .eq("user_id", user.id)
    .eq("id", clientId)
    .maybeSingle();

  if (!client?.ghl_contact_id)
    return { imported: 0, error: "Client has no GHL contact id." };

  const res = await ghlListNotes(
    user.ghl_location_id,
    user.ghl_api_key,
    client.ghl_contact_id,
  );
  if (!res.ok || !res.data)
    return { imported: 0, error: res.error ?? "GHL fetch failed." };

  const notes = (res.data.notes ?? []) as Array<Record<string, unknown>>;
  if (notes.length === 0) return { imported: 0 };

  const rows = notes
    .map((n) => {
      const ghlNoteId = String(n.id ?? n._id ?? "");
      if (!ghlNoteId) return null;
      return {
        user_id: user.id,
        client_id: clientId,
        ghl_note_id: ghlNoteId,
        body: stripHtml(String(n.body ?? n.note ?? "")).trim(),
        created_at:
          (n.dateAdded as string | undefined) ??
          (n.createdAt as string | undefined) ??
          undefined,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null && r.body.length > 0);

  if (rows.length > 0) {
    const { error } = await supabase
      .from("notes")
      .upsert(rows, { onConflict: "ghl_note_id" });
    if (error) return { imported: 0, error: error.message };
  }

  revalidatePath(`/clients/${clientId}`);
  return { imported: rows.length };
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
          `INV-${ghlId.slice(-6)}`,
        name: (inv.name as string | undefined) ?? null,
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
        // Carry GHL's original timestamp instead of letting Supabase default
        // to now(). Tries the most-likely field names; falls back gracefully.
        created_at:
          (inv.createdAt as string | undefined) ??
          (inv.dateAdded as string | undefined) ??
          (inv.issueDate as string | undefined) ??
          (inv.created_at as string | undefined) ??
          undefined,
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

      // GHL returns estimate status under several different field names
      // depending on account configuration and API version.
      const rawStatus = (
        (e.status as string | undefined) ??
        (e.estimateStatus as string | undefined) ??
        (e.invoiceStatus as string | undefined) ??
        (e.documentStatus as string | undefined) ??
        ""
      ).toLowerCase().trim();

      // Log on first item so we can see the real GHL estimate+item shape.
      if (rows.length === 0) {
        const firstItem = ((e.invoiceItems ?? e.items ?? []) as Record<string, unknown>[])[0] ?? {};
        console.log("GHL_ESTIMATE_SAMPLE", JSON.stringify({
          keys: Object.keys(e),
          itemKeys: Object.keys(firstItem),
          itemType: firstItem.type,
          itemCurrency: firstItem.currency,
        }));
      }

      const status =
        ["invoiced", "converted", "invoice_created"].includes(rawStatus)
          ? "invoiced"
          : ["accepted", "approved", "signed", "completed"].includes(rawStatus)
            ? "approved"
            : ["declined", "rejected", "cancelled"].includes(rawStatus)
              ? "declined"
              : ["sent", "viewed", "opened", "delivered"].includes(rawStatus)
                ? "sent"
                : "draft";

      rows.push({
        user_id: user.id,
        client_id: clientId,
        ghl_invoice_id: ghlId,
        estimate_number:
          (e.estimateNumber as string | undefined) ??
          `EST-${ghlId.slice(-6)}`,
        name: (e.name as string | undefined) ?? null,
        line_items: mapGhlLineItems(e.invoiceItems ?? e.items ?? e.lineItems),
        total: Number(e.total ?? e.amount ?? 0) || 0,
        status,
        sent_at:
          status === "sent" || status === "approved" || status === "declined"
            ? ((e.updatedAt as string | undefined) ?? new Date().toISOString())
            : null,
        // Preserve GHL's original date so the list shows when the estimate was
        // actually created, not when we imported it.
        created_at:
          (e.createdAt as string | undefined) ??
          (e.dateAdded as string | undefined) ??
          (e.estimateDate as string | undefined) ??
          (e.created_at as string | undefined) ??
          undefined,
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

/**
 * Pull existing products from GHL into Smintos's product catalog.
 */
export async function importGhlProductsAction(): Promise<{
  imported: number;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { imported: 0, error: "Not signed in." };
  if (!hasGhlCreds(user))
    return { imported: 0, error: "Connect GoHighLevel first." };

  const supabase = createServiceSupabase();
  const PAGE = 100;
  const MAX_PAGES = 25;
  let imported = 0;
  let offset = 0;

  for (let p = 0; p < MAX_PAGES; p++) {
    const res = await ghlListProducts(user.ghl_location_id, user.ghl_api_key, {
      limit: PAGE,
      offset,
    });
    if (!res.ok || !res.data)
      return { imported, error: res.error ?? "GHL fetch failed." };

    const items = (res.data.products ?? []) as Array<Record<string, unknown>>;
    if (items.length === 0) break;

    const rows = items
      .map((prod) => {
        const ghlId = String(prod._id ?? prod.id ?? "");
        if (!ghlId) return null;
        // Default price = first item in `prices` array (GHL products can have
        // multiple variants); fall back to top-level amount.
        const pricesArr = Array.isArray(prod.prices)
          ? (prod.prices as Array<Record<string, unknown>>)
          : [];
        const defaultPrice = pricesArr[0];
        const unitPrice =
          Number(
            defaultPrice?.amount ?? prod.amount ?? prod.price ?? 0,
          ) || 0;
        return {
          user_id: user.id,
          ghl_product_id: ghlId,
          name: stripHtml(prod.name as string | undefined) || "Unnamed product",
          description: stripHtml(prod.description as string | undefined) || null,
          unit_price: unitPrice,
          created_at:
            (prod.createdAt as string | undefined) ??
            (prod.dateAdded as string | undefined) ??
            (prod.created_at as string | undefined) ??
            undefined,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    if (rows.length > 0) {
      const { error } = await supabase
        .from("products")
        .upsert(rows, { onConflict: "user_id,ghl_product_id" });
      if (error) return { imported, error: error.message };
      imported += rows.length;
    }

    if (items.length < PAGE) break;
    offset += PAGE;
  }

  revalidatePath("/library");
  return { imported };
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
      const channelRaw = String((m.type as string | undefined) ?? (m.messageType as string | undefined) ?? "SMS");
      // GHL uses type=4 or "TYPE_CALL"/"CALL" for phone calls; type=5 for voicemail
      const isCall = channelRaw.toLowerCase().includes("call") ||
                     channelRaw.toLowerCase().includes("voicemail") ||
                     Number(m.type) === 4 || Number(m.type) === 5;
      const meta = (m.meta ?? {}) as Record<string, unknown>;

      // Extract call-specific fields defensively across GHL API versions
      const callDuration = isCall
        ? Number(m.callDuration ?? meta.callDuration ?? m.duration ?? 0) || null
        : null;
      const callStatus = isCall
        ? (String(m.callStatus ?? meta.callStatus ?? m.status ?? "").toLowerCase() || null)
        : null;
      const rawAttachments = Array.isArray(m.attachments) ? m.attachments as string[] : [];
      const recordingUrl = isCall
        ? (rawAttachments.find((a) => typeof a === "string" && a.length > 0) ??
           (String(meta.recordingUrl ?? meta.recording ?? "") || null))
        : null;
      const transcript = isCall
        ? (String(m.transcriptionText ?? m.transcription ?? meta.transcription ?? "") || null)
        : null;

      return {
        user_id: user.id,
        client_id: clientId,
        ghl_contact_id: contactId,
        ghl_conversation_id: convId,
        ghl_message_id: String(m.id ?? m._id ?? "") || null,
        direction: dir === "outbound" ? "outbound" : "inbound",
        channel: channelRaw,
        body: (m.body as string | undefined) ?? (m.message as string | undefined) ?? null,
        status: (m.status as string | undefined) ?? null,
        call_duration: callDuration,
        call_status: callStatus,
        recording_url: recordingUrl,
        transcript,
        created_at:
          (m.dateAdded as string | undefined) ??
          (m.created_at as string | undefined) ??
          undefined,
      };
    }).filter((r) => r.ghl_message_id);

    // For call messages without an inline transcript, fetch from GHL's transcription endpoint
    for (const row of rows) {
      if (row.call_duration !== null && !row.transcript && row.ghl_message_id) {
        const tRes = await getCallTranscription(user.ghl_api_key, row.ghl_message_id);
        if (tRes.ok && tRes.data?.transcriptionText) {
          row.transcript = tRes.data.transcriptionText;
        }
      }
    }

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

// ─── Fetch transcript for a single call message ─────────────────────────────

export async function fetchCallTranscriptAction(messageId: string): Promise<{
  ok: boolean;
  transcript?: string;
  error?: string;
}> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!hasGhlCreds(user)) return { ok: false, error: "Connect GoHighLevel first." };

  const res = await getCallTranscription(user.ghl_api_key, messageId);
  if (!res.ok || !res.data?.transcriptionText) {
    return { ok: false, error: "No transcript available for this call." };
  }

  const supabase = createServiceSupabase();
  await supabase
    .from("messages")
    .update({ transcript: res.data.transcriptionText })
    .eq("user_id", user.id)
    .eq("ghl_message_id", messageId);

  revalidatePath("/messages");
  return { ok: true, transcript: res.data.transcriptionText };
}

// --- Settings -------------------------------------------------------------

export async function updateSettingsAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const business_name = String(formData.get("business_name") ?? "").trim() || null;
  const ghl_location_id =
    String(formData.get("ghl_location_id") ?? "").trim() || null;
  const ghl_api_key_raw = String(formData.get("ghl_api_key") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim() || null;
  const default_terms = String(formData.get("default_terms") ?? "").trim() || null;

  const update: Record<string, string | null> = {
    business_name,
    ghl_location_id,
    timezone,
    default_terms,
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

// --- Calendar create-sheet pickers ----------------------------------------

/** Fetch estimates + invoices for a contact to populate the job-title picker. */
export async function fetchContactWorkAction(opts: {
  contactId?: string;
  contactName?: string;
}): Promise<{
  estimates: Array<{ id: string; estimate_number: string; name: string | null; total: number; status: string }>;
  invoices: Array<{ id: string; invoice_number: string; name: string | null; total: number; status: string }>;
}> {
  const user = await getCurrentUser();
  if (!user) return { estimates: [], invoices: [] };

  const supabase = createServiceSupabase();
  let clientId: string | null = null;

  if (opts.contactId) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .eq("ghl_contact_id", opts.contactId)
      .maybeSingle();
    clientId = data?.id ?? null;
  }

  if (!clientId && opts.contactName) {
    const { data } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .ilike("name", `%${opts.contactName}%`)
      .limit(1)
      .maybeSingle();
    clientId = data?.id ?? null;
  }

  if (!clientId) return { estimates: [], invoices: [] };

  const [estRes, invRes] = await Promise.all([
    supabase
      .from("estimates")
      .select("id, estimate_number, name, total, status")
      .eq("user_id", user.id)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
    supabase
      .from("invoices")
      .select("id, invoice_number, name, total, status")
      .eq("user_id", user.id)
      .eq("client_id", clientId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    estimates: (estRes.data ?? []) as Array<{ id: string; estimate_number: string; name: string | null; total: number; status: string }>,
    invoices: (invRes.data ?? []) as Array<{ id: string; invoice_number: string; name: string | null; total: number; status: string }>,
  };
}

/** Fetch the user's products for use in the job-title picker. */
export async function fetchProductsForPickerAction(): Promise<
  Array<{ id: string; name: string; unit_price: number }>
> {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await createServiceSupabase()
    .from("products")
    .select("id, name, unit_price")
    .eq("user_id", user.id)
    .order("name");
  return (data ?? []) as Array<{ id: string; name: string; unit_price: number }>;
}

/** Fetch the crew member name list for the current user. */
export async function fetchCrewMembersAction(): Promise<string[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await createServiceSupabase()
    .from("crew_members")
    .select("name")
    .eq("user_id", user.id)
    .order("name");
  return (data ?? []).map((r: { name: string }) => r.name);
}

/** Add a new crew member for the current user. */
export async function addCrewMemberAction(name: string): Promise<{ ok: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false };
  const trimmed = name.trim();
  if (!trimmed) return { ok: false };
  await createServiceSupabase()
    .from("crew_members")
    .insert({ user_id: user.id, name: trimmed });
  revalidatePath("/calendar");
  return { ok: true };
}

/** Fetch all clients (minimal fields) for the contact picker in the appointment form. */
export async function fetchClientsForPickerAction(): Promise<
  Array<{ id: string; name: string; address: string | null; ghl_contact_id: string | null }>
> {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data } = await createServiceSupabase()
    .from("clients")
    .select("id, name, address, ghl_contact_id")
    .eq("user_id", user.id)
    .order("name");
  return (data ?? []) as Array<{ id: string; name: string; address: string | null; ghl_contact_id: string | null }>;
}

/**
 * Create a new client without redirecting — used by the inline "New contact"
 * form inside the appointment create sheet. Returns the created client on success.
 */
export async function quickCreateClientAction(input: {
  firstName: string;
  lastName: string;
  phone?: string;
  email?: string;
}): Promise<
  | { ok: true; client: { id: string; name: string; ghl_contact_id: string | null; address: string | null } }
  | { ok: false; error: string }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const firstName = toTitleCase(input.firstName.trim());
  const lastName  = toTitleCase(input.lastName.trim());
  const name = [firstName, lastName].filter(Boolean).join(" ");
  if (!name) return { ok: false, error: "First name is required." };

  const phone = input.phone?.trim() || null;
  const email = input.email?.trim() || null;

  let ghlContactId: string | null = null;
  if (hasGhlCreds(user)) {
    const res = await createContact(user.ghl_location_id, user.ghl_api_key, {
      name,
      firstName: firstName || undefined,
      phone: phone ?? undefined,
      email: email ?? undefined,
    });
    if (res.ok && res.data?.contact?.id) ghlContactId = res.data.contact.id;
  }

  const supabase = createServiceSupabase();
  const { data: row, error } = await supabase
    .from("clients")
    .insert({ user_id: user.id, ghl_contact_id: ghlContactId, name, phone, email })
    .select("id, name, ghl_contact_id, address")
    .maybeSingle();

  if (error || !row) return { ok: false, error: error?.message ?? "Failed to create contact." };

  revalidatePath("/clients");

  const c = row as { id: string; name: string; ghl_contact_id: string | null; address: string | null };
  return { ok: true, client: { id: c.id, name: c.name, ghl_contact_id: c.ghl_contact_id, address: c.address } };
}

// ─── Sync everything from GHL at once ──────────────────────────────────────

export async function syncAllGhlAction(): Promise<{
  ok: boolean;
  summary?: string;
  error?: string;
}> {
  // Contacts must run first — estimates/invoices reference them by GHL contact id
  const contacts = await importGhlContactsAction();
  if (contacts.error) return { ok: false, error: `Contacts: ${contacts.error}` };

  const [estimates, invoices, products, messages] = await Promise.all([
    importGhlEstimatesAction(),
    importGhlInvoicesAction(),
    importGhlProductsAction(),
    importGhlMessagesAction(),
  ]);

  const errors = [
    estimates.error && `Estimates: ${estimates.error}`,
    invoices.error  && `Invoices: ${invoices.error}`,
    products.error  && `Products: ${products.error}`,
    messages.error  && `Messages: ${messages.error}`,
  ].filter(Boolean);

  if (errors.length > 0) return { ok: false, error: errors.join(" · ") };

  const summary = [
    `${contacts.imported} contacts`,
    `${estimates.imported} estimates`,
    `${invoices.imported} invoices`,
    `${products.imported} products`,
    `${messages.imported} messages`,
  ].join(" · ");

  revalidatePath("/");
  return { ok: true, summary };
}

// ---------------------------------------------------------------------------
// Contact tags
// ---------------------------------------------------------------------------

export async function fetchContactTagsAction(
  ghlContactId: string,
): Promise<{ ok: boolean; tags: string[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !hasGhlCreds(user)) return { ok: false, tags: [], error: "No GHL credentials" };
  const res = await getContact(user.ghl_api_key, ghlContactId);
  if (!res.ok) return { ok: false, tags: [], error: res.error ?? "Failed" };
  return { ok: true, tags: res.data?.contact?.tags ?? [] };
}

export async function fetchLocationTagsAction(): Promise<{ ok: boolean; tags: string[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !hasGhlCreds(user)) return { ok: false, tags: [], error: "No GHL credentials" };
  const res = await getLocationTags(user.ghl_location_id, user.ghl_api_key);
  if (!res.ok) return { ok: false, tags: [], error: res.error ?? "Failed" };
  return { ok: true, tags: (res.data?.tags ?? []).map((t) => t.name) };
}

export async function addContactTagAction(
  ghlContactId: string,
  tag: string,
): Promise<{ ok: boolean; tags: string[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !hasGhlCreds(user)) return { ok: false, tags: [], error: "No GHL credentials" };
  const res = await addContactTags(user.ghl_api_key, ghlContactId, [tag]);
  if (!res.ok) return { ok: false, tags: [], error: res.error ?? "Failed" };
  return { ok: true, tags: res.data?.tags ?? [] };
}

export async function removeContactTagAction(
  ghlContactId: string,
  tag: string,
): Promise<{ ok: boolean; tags: string[]; error?: string }> {
  const user = await getCurrentUser();
  if (!user || !hasGhlCreds(user)) return { ok: false, tags: [], error: "No GHL credentials" };
  const res = await removeContactTags(user.ghl_api_key, ghlContactId, [tag]);
  if (!res.ok) return { ok: false, tags: [], error: res.error ?? "Failed" };
  return { ok: true, tags: res.data?.tags ?? [] };
}
