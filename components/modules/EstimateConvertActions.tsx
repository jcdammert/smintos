"use client";

import { useTransition } from "react";
import {
  convertEstimateToAppointmentAction,
  convertEstimateToInvoiceAction,
} from "@/lib/actions";

export function EstimateConvertActions({
  estimateId,
  hasAppointment,
  hasInvoice,
}: {
  estimateId: string;
  hasAppointment: boolean;
  hasInvoice: boolean;
}) {
  const [pending, start] = useTransition();

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Convert
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => convertEstimateToAppointmentAction(estimateId))}
          className="relative min-h-[56px] rounded-card border-2 border-mint bg-mint/10 px-3 text-sm font-semibold text-mint-dark transition active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "…" : "→ Schedule"}
          {hasAppointment && (
            <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-mint text-[9px] font-bold text-ink">
              ✓
            </span>
          )}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => start(() => convertEstimateToInvoiceAction(estimateId))}
          className="relative min-h-[56px] rounded-card bg-mint px-3 text-sm font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "…" : "→ Invoice"}
          {hasInvoice && (
            <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-ink/20 text-[9px] font-bold text-ink">
              ✓
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
