"use client";

import { useTransition } from "react";
import {
  sendEstimateAction,
  setEstimateStatusAction,
  convertEstimateToInvoiceAction,
} from "@/lib/actions";
import type { EstimateStatus } from "@/types";

export function EstimateActions({
  estimateId,
  status,
}: {
  estimateId: string;
  status: EstimateStatus;
}) {
  const [pending, start] = useTransition();

  if (status === "approved") {
    return (
      <button
        disabled={pending}
        onClick={() => start(() => convertEstimateToInvoiceAction(estimateId))}
        className="min-h-[52px] w-full rounded-card bg-mint text-base font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Converting…" : "Convert to Invoice →"}
      </button>
    );
  }

  if (status === "declined") {
    return (
      <p className="rounded-card bg-danger/10 p-3 text-center text-sm font-medium text-danger">
        This estimate was declined.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {status === "draft" && (
        <button
          disabled={pending}
          onClick={() => start(() => sendEstimateAction(estimateId))}
          className="min-h-[52px] w-full rounded-card bg-mint text-base font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Sending…" : "Send to client (SMS/email)"}
        </button>
      )}
      {status === "sent" && (
        <div className="grid grid-cols-2 gap-2">
          <button
            disabled={pending}
            onClick={() =>
              start(() => setEstimateStatusAction(estimateId, "approved"))
            }
            className="min-h-[52px] rounded-card bg-mint text-sm font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
          >
            Mark approved
          </button>
          <button
            disabled={pending}
            onClick={() =>
              start(() => setEstimateStatusAction(estimateId, "declined"))
            }
            className="min-h-[52px] rounded-card border border-line bg-white text-sm font-semibold text-text-primary transition active:scale-[0.98] disabled:opacity-50"
          >
            Mark declined
          </button>
        </div>
      )}
    </div>
  );
}
