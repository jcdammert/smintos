import { NextResponse } from "next/server";
import { getCurrentUser, hasGhlCreds } from "@/lib/session";
import { createInvoice, updateInvoice, sendInvoice } from "@/lib/ghl";
import type { GhlInvoiceInput } from "@/types";

/**
 * Server-side proxy for GHL invoice calls.
 *
 * POST { data }                          -> create invoice
 * POST { action: "send", invoiceId }     -> send invoice
 * PUT  { invoiceId, data }               -> update invoice (e.g. status)
 */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasGhlCreds(user))
    return NextResponse.json({ error: "GHL not connected" }, { status: 400 });

  const body = (await req.json()) as {
    action?: "send";
    invoiceId?: string;
    data?: GhlInvoiceInput;
  };

  if (body.action === "send" && body.invoiceId) {
    const res = await sendInvoice(
      user.ghl_location_id,
      user.ghl_api_key,
      body.invoiceId,
    );
    return NextResponse.json(res, { status: res.ok ? 200 : res.status || 500 });
  }

  if (!body.data)
    return NextResponse.json({ error: "Missing data" }, { status: 400 });

  const res = await createInvoice(
    user.ghl_location_id,
    user.ghl_api_key,
    body.data,
  );
  return NextResponse.json(res, { status: res.ok ? 200 : res.status || 500 });
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasGhlCreds(user))
    return NextResponse.json({ error: "GHL not connected" }, { status: 400 });

  const body = (await req.json()) as {
    invoiceId: string;
    data: Partial<GhlInvoiceInput> & { status?: string };
  };
  const res = await updateInvoice(
    user.ghl_location_id,
    user.ghl_api_key,
    body.invoiceId,
    body.data,
  );
  return NextResponse.json(res, { status: res.ok ? 200 : res.status || 500 });
}
