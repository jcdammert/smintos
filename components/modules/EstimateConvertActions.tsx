"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { convertEstimateToInvoiceAction } from "@/lib/actions";

interface Prefill {
  contactName: string | null;
  contactId: string | null;
  address: string | null;
  jobType: string | null;
}

export function EstimateConvertActions({
  estimateId,
  hasAppointment,
  hasInvoice,
  prefill,
}: {
  estimateId: string;
  hasAppointment: boolean;
  hasInvoice: boolean;
  prefill: Prefill;
}) {
  const router = useRouter();
  const [invPending, startInv] = useTransition();

  function openSchedule() {
    const p = new URLSearchParams({ new: "1", estimate_id: estimateId });
    if (prefill.contactName) p.set("contact_name", prefill.contactName);
    if (prefill.contactId)   p.set("contact_id",   prefill.contactId);
    if (prefill.address)     p.set("address",       prefill.address);
    if (prefill.jobType)     p.set("job_type",      prefill.jobType);
    router.push(`/calendar?${p.toString()}`);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Convert
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={openSchedule}
          className="relative min-h-[56px] rounded-card border-2 border-mint bg-mint/10 px-3 text-sm font-semibold text-mint-dark transition active:scale-[0.98]"
        >
          → Schedule
          {hasAppointment && (
            <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-mint text-[9px] font-bold text-ink">
              ✓
            </span>
          )}
        </button>
        <button
          type="button"
          disabled={invPending}
          onClick={() => startInv(() => convertEstimateToInvoiceAction(estimateId))}
          className="relative min-h-[56px] rounded-card bg-mint px-3 text-sm font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
        >
          {invPending ? "…" : "→ Invoice"}
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
