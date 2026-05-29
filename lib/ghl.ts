import type {
  GhlResult,
  GhlContactInput,
  GhlContactResponse,
  GhlListContactsResponse,
  GhlInvoiceInput,
  GhlInvoiceResponse,
  GhlCalendarEventInput,
  GhlCalendarEventResponse,
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
