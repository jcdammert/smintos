import { createServiceSupabase } from "@/lib/supabase";
import type {
  Appointment,
  Client,
  Estimate,
  Invoice,
  Message,
  Note,
  Product,
  WithClient,
} from "@/types";


/**
 * All reads go through the service client but are ALWAYS filtered by user_id.
 * RLS is the safety net; explicit filtering is the primary guard (per spec rule 3).
 */

// Columns for list views — excludes line_items (JSON blob, not needed for lists).
// Detail pages use select("*") to get the full record.
const ESTIMATE_LIST_COLS =
  "id, user_id, client_id, ghl_invoice_id, estimate_number, name, total, status, sent_at, viewed_at, expires_at, created_at";
const INVOICE_LIST_COLS =
  "id, user_id, client_id, estimate_id, ghl_invoice_id, invoice_number, name, total, status, due_date, viewed_at, paid_at, created_at";

export async function getClients(userId: string): Promise<Client[]> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data as Client[] | null) ?? [];
}

export async function getClient(
  userId: string,
  id: string,
): Promise<Client | null> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("clients")
    .select("*")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  return (data as Client | null) ?? null;
}

export async function getEstimates(
  userId: string,
): Promise<WithClient<Estimate>[]> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("estimates")
    .select(`${ESTIMATE_LIST_COLS}, client:clients(id, name)`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data as WithClient<Estimate>[] | null) ?? [];
}

/** Fetches only estimates belonging to a specific client — avoids loading all estimates on client detail. */
export async function getEstimatesForClient(
  userId: string,
  clientId: string,
): Promise<WithClient<Estimate>[]> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("estimates")
    .select(`${ESTIMATE_LIST_COLS}, client:clients(id, name)`)
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return (data as WithClient<Estimate>[] | null) ?? [];
}

export async function getEstimate(
  userId: string,
  id: string,
): Promise<WithClient<Estimate> | null> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("estimates")
    .select("*, client:clients(id, name)")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  return (data as WithClient<Estimate> | null) ?? null;
}

export async function getInvoices(
  userId: string,
): Promise<WithClient<Invoice>[]> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("invoices")
    .select(`${INVOICE_LIST_COLS}, client:clients(id, name)`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data as WithClient<Invoice>[] | null) ?? [];
}

/** Fetches only invoices belonging to a specific client — avoids loading all invoices on client detail. */
export async function getInvoicesForClient(
  userId: string,
  clientId: string,
): Promise<WithClient<Invoice>[]> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("invoices")
    .select(`${INVOICE_LIST_COLS}, client:clients(id, name)`)
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return (data as WithClient<Invoice>[] | null) ?? [];
}

export async function getInvoice(
  userId: string,
  id: string,
): Promise<WithClient<Invoice> | null> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("invoices")
    .select("*, client:clients(id, name)")
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  return (data as WithClient<Invoice> | null) ?? null;
}

/** Appointments within a date range — used by the calendar view. */
export async function getCalendarAppointments(
  userId: string,
  from: string,
  to: string,
): Promise<Appointment[]> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("user_id", userId)
    .gte("start_time", from)
    .lte("start_time", to)
    .order("start_time", { ascending: true });
  return (data as Appointment[] | null) ?? [];
}

/** Today's appointments only — used on the dashboard. */
export async function getTodayAppointments(
  userId: string,
): Promise<Appointment[]> {
  const supabase = createServiceSupabase();
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString();
  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("user_id", userId)
    .gte("start_time", todayStart)
    .lt("start_time", todayEnd)
    .order("start_time", { ascending: true });
  return (data as Appointment[] | null) ?? [];
}

/** Upcoming appointments (from start of today) — used on the schedule page. */
export async function getUpcomingAppointments(
  userId: string,
): Promise<Appointment[]> {
  const supabase = createServiceSupabase();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data } = await supabase
    .from("appointments")
    .select("*")
    .eq("user_id", userId)
    .gte("start_time", todayStart.toISOString())
    .order("start_time", { ascending: true });
  return (data as Appointment[] | null) ?? [];
}

export async function getNotes(
  userId: string,
  clientId: string,
): Promise<Note[]> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("notes")
    .select("id, user_id, client_id, ghl_note_id, body, created_at, updated_at")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: false });
  return (data as Note[] | null) ?? [];
}

export async function getProducts(userId: string): Promise<Product[]> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("products")
    .select("id, user_id, ghl_product_id, name, description, unit_price, created_at")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  return (data as Product[] | null) ?? [];
}

export interface MessageThread {
  client: Pick<Client, "id" | "name"> | null;
  ghl_contact_id: string | null;
  last: Message;
}

/**
 * One row per conversation, showing the most recent message — what the
 * Messages list page renders.
 */
export async function getMessageThreads(
  userId: string,
): Promise<MessageThread[]> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("messages")
    .select("*, client:clients(id, name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  const list = (data ?? []) as (Message & {
    client: { id: string; name: string } | null;
  })[];

  const seen = new Set<string>();
  const threads: MessageThread[] = [];
  for (const m of list) {
    const key = m.client_id ?? m.ghl_contact_id ?? m.id;
    if (seen.has(key)) continue;
    seen.add(key);
    threads.push({
      client: m.client,
      ghl_contact_id: m.ghl_contact_id,
      last: m,
    });
  }
  return threads;
}

export async function getMessagesForClient(
  userId: string,
  clientId: string,
): Promise<Message[]> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("user_id", userId)
    .eq("client_id", clientId)
    .order("created_at", { ascending: true })
    .limit(200);
  return (data as Message[] | null) ?? [];
}

export function isToday(iso: string): boolean {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
