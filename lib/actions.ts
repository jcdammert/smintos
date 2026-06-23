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
  createInvoice,
  updateInvoice,
  createCalendarEvent,
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
} from "@/lib/ghl";
import type { GhlInvoiceItem, LineItem } from "@/types";

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

  const name = toTitleCase(String(formData.get("name") ?? ""));
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

  const name = toTitleCase(String(formData.get("name") ?? ""));
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
        name, phone: phone ?? undefined, email: email ?? undefined,
        address1: address ?? undefined, city: city ?? undefined,
        state: state ?? undefined, postalCode: postalCode ?? undefined,
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
  const total = Math.max(0, subtotal - discountAmount);

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

    const today = new Date().toISOString().slice(0, 10);
    const expiry = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

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
      currency: "USD",
      businessDetails: { name: userRecord?.business_name ?? "My Business" },
      issueDate: today,
      expiryDate: expiry,
      discount: { type: "percentage", value: 0 },
      frequencySettings: { enabled: false },
      items: lineItems.map((i): GhlInvoiceItem => {
        const item: GhlInvoiceItem = {
          // GHL requires `type` on each line item.
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
      console.log("GHL_CREATE_ESTIMATE: estimate endpoint not found, falling back to invoice");
      res = await ghlCreateEstimateViaInvoice(
        user.ghl_location_id,
        user.ghl_api_key,
        estimatePayload,
      );
    }

    // Log full response so we can see the ID field name.
    console.log("GHL_CREATE_ESTIMATE", JSON.stringify({
      ok: res.ok,
      status: res.status,
      error: res.error,
      dataKeys: res.data ? Object.keys(res.data as object) : null,
      data: JSON.stringify(res.data),
    }));

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
      console.log("GHL_CREATE_ESTIMATE id extracted=", ghlEstimateId);
    }
  }

  const { data } = await supabase
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
    })
    .select("id")
    .maybeSingle();

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
  if (hasGhlCreds(user) && est?.ghl_invoice_id) {
    await ghlDeleteEstimate(user.ghl_location_id, user.ghl_api_key, est.ghl_invoice_id);
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

export async function sendEstimateAction(estimateId: string) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const supabase = createServiceSupabase();
  const { data: estimate } = await supabase
    .from("estimates")
    .select("*, client:clients(id, name, ghl_contact_id)")
    .eq("user_id", user.id)
    .eq("id", estimateId)
    .maybeSingle();

  if (!estimate) return;

  let ghlId = estimate.ghl_invoice_id as string | null;

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
      const today2 = new Date().toISOString().slice(0, 10);
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

    // Now send it via GHL (triggers their SMS/email templates).
    if (ghlId) {
      await ghlSendEstimate(user.ghl_location_id, user.ghl_api_key, ghlId);
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
        name: i.description, description: i.notes ?? undefined,
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

  if (hasGhlCreds(user) && client?.ghl_contact_id) {
    const res = await createInvoice(user.ghl_location_id, user.ghl_api_key, {
      contactId: client.ghl_contact_id,
      name: name ?? `Invoice ${shortNumber("INV")}`,
      items: lineItems.map((i) => ({
        name: i.description, description: i.notes ?? undefined,
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
  const timezone = String(formData.get("timezone") ?? "").trim() || null;

  const update: Record<string, string | null> = {
    business_name,
    ghl_location_id,
    timezone,
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
