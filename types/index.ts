// ---------------------------------------------------------------------------
// Domain types — mirror the Supabase schema. No `any` allowed (strict mode).
// ---------------------------------------------------------------------------

export type EstimateStatus = "draft" | "sent" | "approved" | "declined";
export type InvoiceStatus = "sent" | "paid" | "overdue";

export interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface UserRecord {
  id: string;
  email: string;
  ghl_location_id: string | null;
  ghl_api_key: string | null;
  business_name: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  user_id: string;
  ghl_contact_id: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
}

export interface Estimate {
  id: string;
  user_id: string;
  client_id: string;
  ghl_invoice_id: string | null;
  estimate_number: string;
  line_items: LineItem[];
  total: number;
  status: EstimateStatus;
  sent_at: string | null;
  expires_at: string | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  user_id: string;
  client_id: string;
  estimate_id: string | null;
  ghl_invoice_id: string | null;
  invoice_number: string;
  line_items: LineItem[];
  total: number;
  status: InvoiceStatus;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface Appointment {
  id: string;
  user_id: string;
  client_id: string;
  ghl_event_id: string | null;
  title: string;
  notes: string | null;
  scheduled_at: string;
  duration_minutes: number;
  assigned_to: string | null;
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
}

export interface GhlContactResponse {
  contact: { id: string; [key: string]: unknown };
}

export interface GhlInvoiceItem {
  name: string;
  qty: number;
  amount: number;
}

export interface GhlInvoiceInput {
  contactId: string;
  name: string;
  items: GhlInvoiceItem[];
  total?: number;
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
