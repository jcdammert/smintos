import { NextResponse } from "next/server";
import { getCurrentUser, hasGhlCreds } from "@/lib/session";

const BASE = "https://services.leadconnectorhq.com";
const VERSION = "2021-07-28";

async function trySend(apiKey: string, estimateId: string, action: string, liveMode: boolean) {
  const res = await fetch(`${BASE}/invoices/estimate/${estimateId}/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Version: VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, liveMode }),
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown;
  try { data = JSON.parse(text); } catch { data = text; }
  return { action, liveMode, status: res.status, ok: res.ok, data };
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

  // Try every plausible action value — first one that returns ok:true wins.
  const candidates = [
    "email_and_sms", "EMAIL_AND_SMS", "email", "EMAIL",
    "sms", "SMS", "send", "SEND", "both", "BOTH",
    "email_sms", "EMAIL_SMS", "sms_email", "SMS_EMAIL",
    "sendEmail", "send_email", "SEND_EMAIL",
  ];

  const results = [];
  for (const action of candidates) {
    const r = await trySend(user.ghl_api_key!, estimateId, action, true);
    results.push(r);
    if (r.ok) {
      return NextResponse.json({
        winner: action,
        status: r.status,
        message: "This action value worked!",
        data: r.data,
        allTried: results,
      });
    }
    // Small delay to avoid rate limiting.
    await new Promise(res => setTimeout(res, 200));
  }

  return NextResponse.json({
    winner: null,
    message: "None of the action values worked.",
    results,
  });
}
