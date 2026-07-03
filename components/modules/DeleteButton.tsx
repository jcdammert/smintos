"use client";

import { useState, useTransition } from "react";
import { deleteEstimateAction, deleteInvoiceAction, deleteAppointmentAction } from "@/lib/actions";

export function DeleteEstimateButton({ estimateId }: { estimateId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full rounded-card border border-danger/30 bg-danger/5 py-3 text-sm font-semibold text-danger transition active:scale-[0.98]"
      >
        Delete estimate
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-center text-sm text-text-secondary">
        This will permanently delete the estimate. Are you sure?
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setConfirming(false)}
          className="min-h-[44px] rounded-card border border-line bg-white text-sm font-semibold text-text-primary"
        >
          Cancel
        </button>
        <button
          disabled={pending}
          onClick={() => start(() => deleteEstimateAction(estimateId))}
          className="min-h-[44px] rounded-card bg-danger text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
    </div>
  );
}

export function DeleteAppointmentButton({ appointmentId }: { appointmentId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full rounded-card border border-danger/30 bg-danger/5 py-3 text-sm font-semibold text-danger transition active:scale-[0.98]"
      >
        Delete appointment
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-center text-sm text-text-secondary">
        This will permanently delete the appointment. Are you sure?
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setConfirming(false)}
          className="min-h-[44px] rounded-card border border-line bg-white text-sm font-semibold text-text-primary"
        >
          Cancel
        </button>
        <button
          disabled={pending}
          onClick={() => start(() => deleteAppointmentAction(appointmentId))}
          className="min-h-[44px] rounded-card bg-danger text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
    </div>
  );
}

export function DeleteInvoiceButton({ invoiceId }: { invoiceId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="w-full rounded-card border border-danger/30 bg-danger/5 py-3 text-sm font-semibold text-danger transition active:scale-[0.98]"
      >
        Delete invoice
      </button>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-center text-sm text-text-secondary">
        This will permanently delete the invoice. Are you sure?
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setConfirming(false)}
          className="min-h-[44px] rounded-card border border-line bg-white text-sm font-semibold text-text-primary"
        >
          Cancel
        </button>
        <button
          disabled={pending}
          onClick={() => start(() => deleteInvoiceAction(invoiceId))}
          className="min-h-[44px] rounded-card bg-danger text-sm font-semibold text-white disabled:opacity-50"
        >
          {pending ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
    </div>
  );
}
