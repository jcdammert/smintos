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

  // Strategy A: use the INVOICE send endpoint (not estimate-specific)
  // GHL estimates are invoices internally — this endpoint has no `action` field.
  const invoiceSendRes = await fetch(`${BASE}/invoices/${estimateId}/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, Version: VERSION, "Content-Type": "application/json" },
    body: JSON.stringify({ altId: locationId, altType: "location" }),
    cache: "no-store",
  });
  const invoiceSendText = await invoiceSendRes.text();
  let invoiceSendData: unknown;
  try { invoiceSendData = JSON.parse(invoiceSendText); } catch { invoiceSendData = invoiceSendText; }

  if (invoiceSendRes.ok) {
    return NextResponse.json({
      winner: "USE /invoices/{id}/send (not /invoices/estimate/{id}/send)",
      status: invoiceSendRes.status,
      data: invoiceSendData,
    });
  }

  // Strategy B: try PATCH on the estimate to set status = sent
  const patchRes = await fetch(`${BASE}/invoices/estimate/${estimateId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${apiKey}`, Version: VERSION, "Content-Type": "application/json" },
    body: JSON.stringify({ altId: locationId, altType: "location", estimateStatus: "sent" }),
    cache: "no-store",
  });
  const patchText = await patchRes.text();
  let patchData: unknown;
  try { patchData = JSON.parse(patchText); } catch { patchData = patchText; }

  // Strategy C: numeric action values (some GHL enums are numbers)
  const numericResults = [];
  for (const n of [1, 2, 3, 4, 0]) {
    const r = await trySend(apiKey, locationId, estimateId, {
      altId: locationId, altType: "location", liveMode: true, action: n,
    });
    numericResults.push({ action: n, status: r.status, ok: r.ok, error: (r.data as Record<string, unknown>)?.message });
    if (r.ok) return NextResponse.json({ winner: `action: ${n}`, data: r.data });
    await new Promise(res => setTimeout(res, 100));
  }

  return NextResponse.json({
    invoiceSendEndpoint: { status: invoiceSendRes.status, ok: invoiceSendRes.ok, data: invoiceSendData },
    estimatePatchStatus: { status: patchRes.status, ok: patchRes.ok, data: patchData },
    numericActionResults: numericResults,
  });
}
