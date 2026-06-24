import { NextResponse } from "next/server";
import { getCurrentUser, hasGhlCreds } from "@/lib/session";

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

async function trySend(apiKey: string, locationId: string, estimateId: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}/invoices/estimate/${estimateId}/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  return { body, status: res.status, ok: res.ok, data };
}

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasGhlCreds(user)) return NextResponse.json({ error: "No GHL creds" }, { status: 400 });

  const url = new URL(req.url);
  const estimateId = url.searchParams.get("id");

  if (!estimateId) {
    // If no estimate ID given, fetch the first draft estimate to use for testing.
    const listRes = await fetch(
      `${BASE}/invoices/estimate/list?altId=${user.ghl_location_id}&altType=location&limit=5&offset=0`,
      {
        headers: { Authorization: `Bearer ${user.ghl_api_key!}`, Version: VERSION },
        cache: "no-store",
      }
    );
    const listData = await listRes.json() as Record<string, unknown>;
    const estimates = (listData.estimates ?? listData.data ?? []) as Array<Record<string, unknown>>;
    // Use the first estimate regardless of status — we just need any ID to test the send endpoint.
    const first = estimates[0];
    if (!first) {
      return NextResponse.json({
        error: "No estimates found in GHL at all.",
        listStatus: listRes.status,
        listData,
      });
    }
    return NextResponse.json({
      hint: `Using estimate for send test. Re-run with ?id=... to test sending.`,
      estimateId: first._id,
      estimateStatus: first.estimateStatus ?? first.status,
      url: `/api/ghl-test/send-estimate?id=${first._id}`,
    });
  }

  const locationId = user.ghl_location_id!;
  const apiKey = user.ghl_api_key!;
  const base = { altId: locationId, altType: "location", liveMode: true };

  // Try: no action field at all first (maybe it's not needed)
  const candidates: Record<string, unknown>[] = [
    { ...base },
    { ...base, action: "email_and_sms" },
    { ...base, action: "EMAIL_AND_SMS" },
    { ...base, action: "email" },
    { ...base, action: "EMAIL" },
    { ...base, action: "sms" },
    { ...base, action: "SMS" },
    { ...base, action: "send" },
    { ...base, action: "SEND" },
    { ...base, action: "both" },
    { ...base, action: "email,sms" },
    // Try different field names for the delivery channel
    { ...base, channel: "email" },
    { ...base, channel: "email_and_sms" },
    { ...base, medium: "email" },
    { ...base, notificationMedium: "email" },
    { ...base, deliveryMethod: "email" },
    { ...base, type: "email" },
  ];

  const results = [];
  for (const body of candidates) {
    const r = await trySend(apiKey, locationId, estimateId, body);
    results.push(r);
    if (r.ok) {
      return NextResponse.json({
        winner: body,
        status: r.status,
        message: "✅ This body worked!",
        data: r.data,
        allTried: results.length,
      });
    }
    await new Promise(res => setTimeout(res, 150));
  }

  return NextResponse.json({
    winner: null,
    message: "None worked. Check errors for clues.",
    // Show only first 3 results to keep response readable
    firstThree: results.slice(0, 3),
    lastOne: results[results.length - 1],
    total: results.length,
  });
}
