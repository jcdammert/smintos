import type { ReactNode } from "react";
import type { EstimateStatus, InvoiceStatus } from "@/types";

type Tone = "neutral" | "mint" | "blue" | "amber" | "red" | "green";

const tones: Record<Tone, string> = {
  neutral: "bg-black/5 text-text-secondary",
  mint: "bg-mint/15 text-[#067a44]",
  blue: "bg-info/10 text-info",
  amber: "bg-warn/10 text-warn",
  red: "bg-danger/10 text-danger",
  green: "bg-[#16a34a]/10 text-[#16a34a]",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

const estimateTone: Record<EstimateStatus, Tone> = {
  draft: "neutral",
  sent: "blue",
  approved: "green",
  declined: "red",
  invoiced: "mint",
};

const invoiceTone: Record<InvoiceStatus, Tone> = {
  sent: "blue",
  paid: "green",
  overdue: "red",
};

export function EstimateBadge({ status }: { status: EstimateStatus }) {
  return <Badge tone={estimateTone[status]}>{status}</Badge>;
}

export function InvoiceBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={invoiceTone[status]}>{status}</Badge>;
}
