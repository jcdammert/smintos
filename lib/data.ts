import { createServiceSupabase } from "@/lib/supabase";
import type {
  Appointment,
  Client,
  Estimate,
  Invoice,
  WithClient,
} from "@/types";

/**
 * All reads go through the service client but are ALWAYS filtered by user_id.
 * RLS is the safety net; explicit filtering is the primary guard (per spec rule 3).
 */

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
    .select("*, client:clients(id, name)")
    .eq("user_id", userId)
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
    .select("*, client:clients(id, name)")
    .eq("user_id", userId)
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

export async function getAppointments(
  userId: string,
): Promise<WithClient<Appointment>[]> {
  const supabase = createServiceSupabase();
  const { data } = await supabase
    .from("appointments")
    .select("*, client:clients(id, name)")
    .eq("user_id", userId)
    .order("scheduled_at", { ascending: true });
  return (data as WithClient<Appointment>[] | null) ?? [];
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
