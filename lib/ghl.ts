import type {
  GhlResult,
  GhlContactInput,
  GhlContactResponse,
  GhlListContactsResponse,
  GhlInvoiceInput,
  GhlInvoiceResponse,
  GhlListInvoicesResponse,
  GhlListEstimatesResponse,
  GhlListProductsResponse,
  GhlCalendarEventInput,
  GhlCalendarEventResponse,
  GhlSendMessageInput,
  GhlSendMessageResponse,
  GhlConversationsSearchResponse,
  GhlMessagesPageResponse,
  GhlNoteInput,
  GhlNoteResponse,
  GhlListNotesResponse,
} from "@/types";

const BASE_URL = "https://services.leadconnectorhq.com";
const API_VERSION = "2021-07-28";

interface RequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  apiKey: string;
  path: string;
  body?: unknown;
}

/**
 * Low-level fetch wrapper for the GHL v2 REST API. Always runs server-side.
 * Returns a typed, never-throwing GhlResult so callers can handle errors gracefully.
 */
async function ghlRequest<T>({
  method,
  apiKey,
  path,
  body,
}: RequestOptions): Promise<GhlResult<T>> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: API_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });

    const text = await res.text();
    const parsed = text ? (JSON.parse(text) as T) : null;

    if (!res.ok) {
      const message =
        (parsed as { message?: string } | null)?.message ??
        `GHL request failed (${res.status})`;
      return { ok: false, data: null, error: message, status: res.status };
    }

    return { ok: true, data: parsed, error: null, status: res.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown GHL error";
    return { ok: false, data: null, error: message, status: 0 };
  }
}

// ---------------------------------------------------------------------------
// Contacts
// ---------------------------------------------------------------------------

export function createContact(
  locationId: string,
  apiKey: string,
  data: GhlContactInput,
): Promise<GhlResult<GhlContactResponse>> {
  return ghlRequest<GhlContactResponse>({
    method: "POST",
    apiKey,
    path: "/contacts/",
    body: { ...data, locationId },
  });
}

export function updateContact(
  locationId: string,
  apiKey: string,
  contactId: string,
  data: GhlContactInput,
): Promise<GhlResult<GhlContactResponse>> {
  return ghlRequest<GhlContactResponse>({
    method: "PUT",
    apiKey,
    path: `/contacts/${contactId}`,
    body: { ...data, locationId },
  });
}

/**
 * Fetch one page of contacts for a location. Pagination is cursor-based:
 * pass the `startAfter` / `startAfterId` from the previous page's `meta`.
 */
export function listContacts(
  locationId: string,
  apiKey: string,
  params: { limit?: number; startAfter?: number; startAfterId?: string } = {},
): Promise<GhlResult<GhlListContactsResponse>> {
  const q = new URLSearchParams();
  q.set("locationId", locationId);
  q.set("limit", String(params.limit ?? 100));
  if (params.startAfter != null) q.set("startAfter", String(params.startAfter));
  if (params.startAfterId) q.set("startAfterId", params.startAfterId);
  return ghlRequest<GhlListContactsResponse>({
    method: "GET",
    apiKey,
    path: `/contacts/?${q.toString()}`,
  });
}

// ---------------------------------------------------------------------------
// Invoices
// ---------------------------------------------------------------------------

/**
 * Create an estimate (quote) in GHL. Uses the estimate-specific endpoint;
 * falls back to the invoice endpoint shape since GHL's estimate API mirrors it.
 */
export function createEstimate(
  locationId: string,
  apiKey: string,
  data: GhlInvoiceInput,
): Promise<GhlResult<GhlInvoiceResponse>> {
  // GHL estimate creation endpoint — altId + altType are mandatory.
  // Some GHL accounts use /invoices/estimate/, others accept /invoices/ with
  // an explicit status:"draft" — we try the dedicated estimate endpoint first.
  return ghlRequest<GhlInvoiceResponse>({
    method: "POST",
    apiKey,
    path: "/invoices/estimate/",
    body: {
      ...data,
      altId: locationId,
      altType: "location",
    },
  });
}

export function deleteEstimate(
  locationId: string,
  apiKey: string,
  estimateId: string,
): Promise<GhlResult<{ succeeded: boolean }>> {
  return ghlRequest<{ succeeded: boolean }>({
    method: "DELETE",
    apiKey,
    path: `/invoices/estimate/${estimateId}?altId=${locationId}&altType=location`,
  });
}

export function sendEstimate(
  locationId: string,
  apiKey: string,
  estimateId: string,
  opts: {
    estimateName: string;
    fromName: string;
    fromEmail: string;
    toEmail: string;
    toPhone?: string;
    userId?: string;
  },
): Promise<GhlResult<GhlInvoiceResponse>> {
  return ghlRequest<GhlInvoiceResponse>({
    method: "POST",
    apiKey,
    path: `/invoices/estimate/${estimateId}/send`,
    body: {
      altId: locationId,
      altType: "location",
      action: "sms_and_email",
      liveMode: true,
      userId: opts.userId,
      estimateName: opts.estimateName,
      sentFrom: {
        fromName: opts.fromName,
        fromEmail: opts.fromEmail,
      },
      sentTo: {
        email: [opts.toEmail],
        emailCc: [],
        emailBcc: [],
        phoneNo: opts.toPhone ? [opts.toPhone] : [],
      },
    },
  });
}

/**
 * Fallback: create an estimate using the standard invoice endpoint with
 * status="draft". Used when the dedicated estimate endpoint returns 404.
 */
export function createEstimateViaInvoice(
  locationId: string,
  apiKey: string,
  data: GhlInvoiceInput,
): Promise<GhlResult<GhlInvoiceResponse>> {
  return ghlRequest<GhlInvoiceResponse>({
    method: "POST",
    apiKey,
    path: "/invoices/",
    body: {
      ...data,
      altId: locationId,
      altType: "location",
      status: "draft",
    },
  });
}

export function createInvoice(
  locationId: string,
  apiKey: string,
  data: GhlInvoiceInput,
): Promise<GhlResult<GhlInvoiceResponse>> {
  return ghlRequest<GhlInvoiceResponse>({
    method: "POST",
    apiKey,
    path: "/invoices/",
    body: { ...data, altId: locationId, altType: "location" },
  });
}

export function updateInvoice(
  locationId: string,
  apiKey: string,
  invoiceId: string,
  data: Partial<GhlInvoiceInput> & { status?: string },
): Promise<GhlResult<GhlInvoiceResponse>> {
  return ghlRequest<GhlInvoiceResponse>({
    method: "PUT",
    apiKey,
    path: `/invoices/${invoiceId}`,
    body: { ...data, altId: locationId, altType: "location" },
  });
}

/**
 * List invoices for a location (used by the historical import).
 */
export function listInvoices(
  locationId: string,
  apiKey: string,
  params: { limit?: number; offset?: number } = {},
): Promise<GhlResult<GhlListInvoicesResponse>> {
  const q = new URLSearchParams();
  q.set("altId", locationId);
  q.set("altType", "location");
  q.set("limit", String(params.limit ?? 100));
  q.set("offset", String(params.offset ?? 0));
  return ghlRequest<GhlListInvoicesResponse>({
    method: "GET",
    apiKey,
    path: `/invoices/?${q.toString()}`,
  });
}

/**
 * List products for a location (used by the product catalog import).
 */
export function listProducts(
  locationId: string,
  apiKey: string,
  params: { limit?: number; offset?: number } = {},
): Promise<GhlResult<GhlListProductsResponse>> {
  const q = new URLSearchParams();
  q.set("locationId", locationId);
  q.set("limit", String(params.limit ?? 100));
  q.set("offset", String(params.offset ?? 0));
  return ghlRequest<GhlListProductsResponse>({
    method: "GET",
    apiKey,
    path: `/products/?${q.toString()}`,
  });
}

/**
 * List estimates for a location.
 */
export function listEstimates(
  locationId: string,
  apiKey: string,
  params: { limit?: number; offset?: number } = {},
): Promise<GhlResult<GhlListEstimatesResponse>> {
  const q = new URLSearchParams();
  q.set("altId", locationId);
  q.set("altType", "location");
  q.set("limit", String(params.limit ?? 100));
  q.set("offset", String(params.offset ?? 0));
  return ghlRequest<GhlListEstimatesResponse>({
    method: "GET",
    apiKey,
    path: `/invoices/estimate/list?${q.toString()}`,
  });
}

export function sendInvoice(
  locationId: string,
  apiKey: string,
  invoiceId: string,
): Promise<GhlResult<GhlInvoiceResponse>> {
  return ghlRequest<GhlInvoiceResponse>({
    method: "POST",
    apiKey,
    path: `/invoices/${invoiceId}/send`,
    body: { altId: locationId, altType: "location" },
  });
}

// ---------------------------------------------------------------------------
// Calendar
// ---------------------------------------------------------------------------

export function createCalendarEvent(
  locationId: string,
  apiKey: string,
  data: GhlCalendarEventInput,
): Promise<GhlResult<GhlCalendarEventResponse>> {
  return ghlRequest<GhlCalendarEventResponse>({
    method: "POST",
    apiKey,
    path: "/calendars/events/",
    body: { ...data, locationId },
  });
}

export function deleteCalendarEvent(
  _locationId: string,
  apiKey: string,
  eventId: string,
): Promise<GhlResult<{ succeeded: boolean }>> {
  return ghlRequest<{ succeeded: boolean }>({
    method: "DELETE",
    apiKey,
    path: `/calendars/events/${eventId}`,
  });
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

/** Fetch the first user for a location — used to get a userId for sending estimates. */
export function getLocationUsers(
  locationId: string,
  apiKey: string,
): Promise<GhlResult<{ users?: Array<{ id: string; name?: string; email?: string }> }>> {
  return ghlRequest({
    method: "GET",
    apiKey,
    path: `/users/?locationId=${locationId}`,
  });
}

// ---------------------------------------------------------------------------
// Notes
// ---------------------------------------------------------------------------

export function createNote(
  _locationId: string,
  apiKey: string,
  contactId: string,
  data: GhlNoteInput,
): Promise<GhlResult<GhlNoteResponse>> {
  return ghlRequest<GhlNoteResponse>({
    method: "POST",
    apiKey,
    path: `/contacts/${contactId}/notes`,
    body: data,
  });
}

export function listNotes(
  _locationId: string,
  apiKey: string,
  contactId: string,
): Promise<GhlResult<GhlListNotesResponse>> {
  return ghlRequest<GhlListNotesResponse>({
    method: "GET",
    apiKey,
    path: `/contacts/${contactId}/notes`,
  });
}

export function deleteNote(
  _locationId: string,
  apiKey: string,
  contactId: string,
  noteId: string,
): Promise<GhlResult<{ succeeded: boolean }>> {
  return ghlRequest<{ succeeded: boolean }>({
    method: "DELETE",
    apiKey,
    path: `/contacts/${contactId}/notes/${noteId}`,
  });
}

// ---------------------------------------------------------------------------
// Conversations / Messages
// ---------------------------------------------------------------------------

/**
 * Send an SMS / Email through GHL on behalf of a contact.
 */
export function sendConversationMessage(
  _locationId: string,
  apiKey: string,
  data: GhlSendMessageInput,
): Promise<GhlResult<GhlSendMessageResponse>> {
  return ghlRequest<GhlSendMessageResponse>({
    method: "POST",
    apiKey,
    path: "/conversations/messages",
    body: data,
  });
}

/**
 * List conversations for a location (used by the historical import).
 */
export function searchConversations(
  locationId: string,
  apiKey: string,
  params: { limit?: number; offset?: number } = {},
): Promise<GhlResult<GhlConversationsSearchResponse>> {
  const q = new URLSearchParams();
  q.set("locationId", locationId);
  q.set("limit", String(params.limit ?? 50));
  if (params.offset) q.set("offset", String(params.offset));
  return ghlRequest<GhlConversationsSearchResponse>({
    method: "GET",
    apiKey,
    path: `/conversations/search?${q.toString()}`,
  });
}

/**
 * List messages inside a single conversation.
 */
export function listConversationMessages(
  _locationId: string,
  apiKey: string,
  conversationId: string,
  params: { limit?: number; lastMessageId?: string } = {},
): Promise<GhlResult<GhlMessagesPageResponse>> {
  const q = new URLSearchParams();
  q.set("limit", String(params.limit ?? 100));
  if (params.lastMessageId) q.set("lastMessageId", params.lastMessageId);
  return ghlRequest<GhlMessagesPageResponse>({
    method: "GET",
    apiKey,
    path: `/conversations/${conversationId}/messages?${q.toString()}`,
  });
}
