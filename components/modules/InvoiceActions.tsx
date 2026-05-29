"use client";

import { useTransition } from "react";
import { markInvoicePaidAction } from "@/lib/actions";
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
    <button
      disabled={pending}
      onClick={() => start(() => markInvoicePaidAction(invoiceId))}
      className="min-h-[52px] w-full rounded-card bg-mint text-base font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "Updating…" : "Mark as Paid"}
    </button>
  );
}
