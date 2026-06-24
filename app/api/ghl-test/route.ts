import { NextResponse } from "next/server";
import { getCurrentUser, hasGhlCreds } from "@/lib/session";

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

async function probe(
  apiKey: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: unknown; error: string | null }> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Version: VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
    });
    const text = await res.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch { /* keep as string */ }
    return { ok: res.ok, status: res.status, data, error: null };
  } catch (err) {
    return { ok: false, status: 0, data: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasGhlCreds(user)) return NextResponse.json({ error: "No GHL credentials" }, { status: 400 });

  const url = new URL(req.url);
  const test = url.searchParams.get("test") ?? "all";
  const locationId = user.ghl_location_id!;
  const apiKey = user.ghl_api_key!;

  const results: Record<string, unknown> = {
    locationId: `${locationId.slice(0, 6)}…`,
    keyPreview: `${apiKey.slice(0, 10)}…`,
  };

  if (test === "all" || test === "contacts") {
    results.contacts = await probe(apiKey, "GET",
      `/contacts/?locationId=${locationId}&limit=1`);
  }

  if (test === "all" || test === "invoices") {
    results.invoices = await probe(apiKey, "GET",
      `/invoices/?altId=${locationId}&altType=location&limit=1&offset=0`);
  }

  if (test === "all" || test === "estimates") {
    results.estimates = await probe(apiKey, "GET",
      `/invoices/estimate/list?altId=${locationId}&altType=location&limit=1`);
  }

  if (test === "all" || test === "calendars") {
    results.calendars = await probe(apiKey, "GET",
      `/calendars/?locationId=${locationId}`);
  }

  if (test === "all" || test === "conversations") {
    results.conversations = await probe(apiKey, "GET",
      `/conversations/search?locationId=${locationId}&limit=1`);
  }

  return NextResponse.json(results);
}
