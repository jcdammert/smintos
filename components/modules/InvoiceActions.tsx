"use client";

import { useTransition } from "react";
import { markInvoicePaidAction, sendInvoiceAction } from "@/lib/actions";
import { SendChannelPicker } from "@/components/modules/SendChannelPicker";
import type { InvoiceStatus } from "@/types";

export function InvoiceActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: InvoiceStatus;
}) {
  const [pending, start] = useTransition();

  if (status === "paid") {
    return (
      <p className="rounded-card bg-[#16a34a]/10 p-3 text-center text-sm font-semibold text-[#16a34a]">
        ✓ Paid — job closed
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <SendChannelPicker
        label="Send invoice"
        onSend={(ch) => sendInvoiceAction(invoiceId, ch)}
      />
      <button
        disabled={pending}
        onClick={() => start(() => markInvoicePaidAction(invoiceId))}
        className="min-h-[52px] w-full rounded-card bg-mint text-base font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Updating…" : "Mark as Paid"}
      </button>
    </div>
  );
}
