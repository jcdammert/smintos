// ---------------------------------------------------------------------------
// Domain types — mirror the Supabase schema. No `any` allowed (strict mode).
// ---------------------------------------------------------------------------

export type EstimateStatus = "draft" | "sent" | "approved" | "declined" | "invoiced";
export type InvoiceStatus = "sent" | "paid" | "overdue";

export interface LineItem {
  id: string;
  description: string; // short name/title — single line
  notes?: string;      // optional longer description shown below the name
  quantity: number;
  unitPrice: number;
}

export interface Discount {
  type: "fixed" | "percent";
  value: number;
}

export interface UserRecord {
  id: string;
  email: string;
  ghl_location_id: string | null;
  ghl_api_key: string | null;
  business_name: string | null;
  timezone: string | null;
  default_terms: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  ghl_contact_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null; // street line 1
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  created_at: string;
}

export interface Estimate {
  id: string;
  user_id: string;
  client_id: string;
  ghl_invoice_id: string | null;
  estimate_number: string | null;
  name: string | null;
  line_items: LineItem[];
  total: number;
  status: EstimateStatus;
  sent_at: string | null;
  viewed_at: string | null;
  expires_at: string | null;
  tax_rate: number | null;
  deposit_amount: number | null;
  deposit_type: string | null;
  terms: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string;
  estimate_id: string | null;
  appointment_id: string | null;
  ghl_invoice_id: string | null;
  invoice_number: string;
  name: string | null;
  line_items: LineItem[];
  total: number;
  status: InvoiceStatus;
  due_date: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  user_id: string;
  ghl_product_id: string | null;
  name: string;
  description: string | null;
  unit_price: number;
  created_at: string;
}

export interface GhlListProductsResponse {
  products?: Array<Record<string, unknown>>;
  total?: number;
}

export interface Note {
  id: string;
  user_id: string;
  client_id: string;
  ghl_note_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface GhlNoteInput {
  body: string;
  userId?: string;
}

export interface GhlNoteResponse {
  note?: { id: string; body?: string; [key: string]: unknown };
  id?: string;
}

export interface GhlListNotesResponse {
  notes?: Array<Record<string, unknown>>;
}

export type MessageDirection = "inbound" | "outbound";

export interface Message {
  id: string;
  user_id: string;
  client_id: string | null;
  ghl_contact_id: string | null;
  ghl_conversation_id: string | null;
  ghl_message_id: string | null;
  direction: MessageDirection;
  channel: string | null;
  body: string | null;
  status: string | null;
  call_duration: number | null;
  call_status: string | null;
  recording_url: string | null;
  transcript: string | null;
  created_at: string;
}

export type AppointmentStatus =
  | "confirmed"
  | "cancelled"
  | "showed"
  | "no_show"
  | "invalid"
  | "unconfirmed";

export interface Appointment {
  id: string;
  user_id: string;
  title: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  contact_id: string | null;
  contact_name: string | null;
  notes: string | null;
  assigned_to: string | null;
  job_type: string | null;
  address: string | null;
  estimate_id: string | null;
  ghl_event_id: string | null;
  created_at: string;
}

// Convenience: a record joined with its client (for list views)
export type WithClient<T> = T & { client: Pick<Client, "id" | "name"> | null };

// ---------------------------------------------------------------------------
// GHL API types
// ---------------------------------------------------------------------------

export interface GhlResult<T> {
  ok: boolean;
  data: T | null;
  error: string | null;
  status: number;
}

export interface GhlContactInput {
  firstName?: string;
  name?: string;
  phone?: string;
  email?: string;
  address1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface GhlContactResponse {
  contact: { id: string; [key: string]: unknown };
}

export interface GhlListContactsResponse {
  contacts: Array<Record<string, unknown>>;
  meta?: {
    startAfterId?: string;
    startAfter?: number;
    nextPageUrl?: string;
    total?: number;
  };
}

export interface GhlInvoiceItem {
  name: string;
  qty: number;
  amount: number;
  description?: string;
  taxes?: unknown[];
  [key: string]: unknown;
}

export interface GhlInvoiceInput {
  contactId: string;
  name: string;
  items: GhlInvoiceItem[];
  total?: number;
  currency?: string;
  businessDetails?: { name: string; logoUrl?: string; address?: string; city?: string; state?: string; country?: string; postalCode?: string; };
  [key: string]: unknown;
}

export interface GhlInvoiceResponse {
  invoice?: { id: string; status?: string; [key: string]: unknown };
  id?: string;
}

export interface GhlCalendarEventInput {
  calendarId?: string;
  contactId: string;
  title: string;
  startTime: string;
  endTime: string;
  notes?: string;
  assignedUserId?: string;
}

export interface GhlCalendarEventResponse {
  id?: string;
  event?: { id: string; [key: string]: unknown };
}

export interface GhlSendMessageInput {
  type: "SMS" | "Email";
  contactId: string;
  message: string;
}

export interface GhlSendMessageResponse {
  conversationId?: string;
  messageId?: string;
  [key: string]: unknown;
}

export interface GhlConversationsSearchResponse {
  conversations?: Array<Record<string, unknown>>;
  total?: number;
}

export interface GhlListInvoicesResponse {
  invoices?: Array<Record<string, unknown>>;
  total?: number;
}

export interface GhlListEstimatesResponse {
  estimates?: Array<Record<string, unknown>>;
  data?: Array<Record<string, unknown>>;
  totalCount?: number;
}

export interface GhlMessagesPageResponse {
  lastMessageId?: string;
  nextPage?: boolean;
  messages?:
    | Array<Record<string, unknown>>
    | { messages?: Array<Record<string, unknown>>; lastMessageId?: string };
}
