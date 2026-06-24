"use client";

import { useState, useTransition } from "react";
import {
  sendEstimateAction,
  setEstimateStatusAction,
  convertEstimateToInvoiceAction,
} from "@/lib/actions";
import { SendChannelPicker } from "@/components/modules/SendChannelPicker";
import type { EstimateStatus } from "@/types";

export function EstimateActions({
  estimateId,
  status,
}: {
  estimateId: string;
  status: EstimateStatus;
}) {
  const [pending, start] = useTransition();
  const [showOverride, setShowOverride] = useState(false);

  // Override picker — lets you manually fix a wrong status (e.g. imported as
  // Draft when it was actually Sent/Approved in GHL).
  const overrideOptions: { label: string; value: EstimateStatus }[] = (
    [
      { label: "Draft", value: "draft" as EstimateStatus },
      { label: "Sent", value: "sent" as EstimateStatus },
      { label: "Approved", value: "approved" as EstimateStatus },
      { label: "Invoiced", value: "invoiced" as EstimateStatus },
      { label: "Declined", value: "declined" as EstimateStatus },
    ] as { label: string; value: EstimateStatus }[]
  ).filter((o) => o.value !== status);

  const overridePicker = (
    <div className="space-y-2">
      {!showOverride ? (
        <button
          type="button"
          onClick={() => setShowOverride(true)}
          className="w-full text-center text-xs text-text-secondary underline"
        >
          Change status manually
        </button>
      ) : (
        <div className="space-y-1">
          <p className="text-center text-xs text-text-secondary">
            Set status to:
          </p>
          <div className="grid grid-cols-2 gap-2">
            {overrideOptions.map((o) => (
              <button
                key={o.value}
                disabled={pending}
                onClick={() => {
                  start(() => setEstimateStatusAction(estimateId, o.value));
                  setShowOverride(false);
                }}
                className="min-h-[44px] rounded-card border border-line bg-white text-xs font-semibold text-text-primary transition active:scale-[0.98] disabled:opacity-50"
              >
                {o.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowOverride(false)}
            className="w-full text-center text-xs text-text-secondary"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );

  if (status === "invoiced") {
    return (
      <div className="space-y-3">
        <p className="rounded-card bg-mint/10 p-3 text-center text-sm font-semibold text-mint-dark">
          ✓ Invoiced — an invoice has been created for this estimate.
        </p>
        {overridePicker}
      </div>
    );
  }

  if (status === "approved") {
    return (
      <div className="space-y-3">
        <button
          disabled={pending}
          onClick={() => start(() => convertEstimateToInvoiceAction(estimateId))}
          className="min-h-[52px] w-full rounded-card bg-mint text-base font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
        >
          {pending ? "Converting…" : "Convert to Invoice →"}
        </button>
        {overridePicker}
      </div>
    );
  }

  if (status === "declined") {
    return (
      <div className="space-y-3">
        <p className="rounded-card bg-danger/10 p-3 text-center text-sm font-medium text-danger">
          This estimate was declined.
        </p>
        {overridePicker}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {status === "draft" && (
        <SendChannelPicker
          label="Send estimate"
          onSend={(ch) => sendEstimateAction(estimateId, ch)}
        />
      )}
      {status === "sent" && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              disabled={pending}
              onClick={() => start(() => setEstimateStatusAction(estimateId, "approved"))}
              className="min-h-[52px] rounded-card bg-mint text-sm font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
            >
              Mark approved
            </button>
            <button
              disabled={pending}
              onClick={() => start(() => setEstimateStatusAction(estimateId, "declined"))}
              className="min-h-[52px] rounded-card border border-line bg-white text-sm font-semibold text-text-primary transition active:scale-[0.98] disabled:opacity-50"
            >
              Mark declined
            </button>
          </div>
          <SendChannelPicker
            label="↩ Resend estimate"
            onSend={(ch) => sendEstimateAction(estimateId, ch)}
          />
        </div>
      )}
      {overridePicker}
    </div>
  );
}
