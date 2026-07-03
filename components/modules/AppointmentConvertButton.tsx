"use client";

import { useTransition } from "react";
import { convertAppointmentToInvoiceAction } from "@/lib/actions";

export function AppointmentConvertButton({
  appointmentId,
  hasInvoice,
}: {
  appointmentId: string;
  hasInvoice: boolean;
}) {
  const [pending, start] = useTransition();

  if (hasInvoice) {
    return (
      <p className="rounded-card bg-mint/10 p-3 text-center text-sm font-semibold text-mint-dark">
        ✓ Invoice created for this appointment
      </p>
    );
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => convertAppointmentToInvoiceAction(appointmentId))}
      className="min-h-[56px] w-full rounded-card bg-mint text-base font-semibold text-ink transition active:scale-[0.98] disabled:opacity-50"
    >
      {pending ? "Creating invoice…" : "Convert to Invoice →"}
    </button>
  );
}
