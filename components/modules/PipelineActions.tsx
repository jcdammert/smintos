"use client";

import { useTransition } from "react";
import {
  convertEstimateToInvoiceAction,
  markInvoicePaidAction,
} from "@/lib/actions";

/** Small inline "→ Invoice" button shown on approved estimates. */
export function ConvertButton({ estimateId }: { estimateId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(() => convertEstimateToInvoiceAction(estimateId));
      }}
      disabled={pending}
      className="rounded-full bg-mint px-3 py-1.5 text-xs font-semibold text-ink transition active:scale-95 disabled:opacity-50"
    >
      {pending ? "…" : "→ Invoice"}
    </button>
  );
}

/** Small inline "Mark Paid" button shown on sent/overdue invoices. */
export function MarkPaidButton({ invoiceId }: { invoiceId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        start(() => markInvoicePaidAction(invoiceId));
      }}
      disabled={pending}
      className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-50"
    >
      {pending ? "…" : "Mark Paid"}
    </button>
  );
}
