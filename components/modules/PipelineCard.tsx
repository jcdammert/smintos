import Link from "next/link";
import { EstimateBadge, InvoiceBadge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";
import type { WithClient, Estimate, Invoice } from "@/types";
import { ConvertButton, MarkPaidButton } from "@/components/modules/PipelineActions";

type PipelineKind = "estimate" | "appointment" | "invoice";

const iconStyles: Record<PipelineKind, string> = {
  estimate: "bg-info/10 text-info",
  appointment: "bg-[#16a34a]/10 text-[#16a34a]",
  invoice: "bg-warn/10 text-warn",
};

function Icon({ kind }: { kind: PipelineKind }) {
  return (
    <div
      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-card ${iconStyles[kind]}`}
    >
      {kind === "estimate" && (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M6 2h8l4 4v16H6V2z" strokeLinejoin="round" />
        </svg>
      )}
      {kind === "appointment" && (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
        </svg>
      )}
      {kind === "invoice" && (
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

export function EstimatePipelineCard({ item }: { item: WithClient<Estimate> }) {
  return (
    <Link
      href={`/estimates/${item.id}`}
      className="flex items-center gap-3 rounded-card border border-line bg-white p-3 transition active:scale-[0.99]"
    >
      <Icon kind="estimate" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text-primary">
          {item.name || item.estimate_number || "—"} · {formatCurrency(item.total)}
        </p>
        <p className="truncate text-sm text-text-secondary">
          {item.client?.name ?? "Unknown client"}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <EstimateBadge status={item.status} />
        {item.status === "approved" && <ConvertButton estimateId={item.id} />}
      </div>
    </Link>
  );
}

export function InvoicePipelineCard({ item }: { item: WithClient<Invoice> }) {
  return (
    <Link
      href={`/invoices/${item.id}`}
      className="flex items-center gap-3 rounded-card border border-line bg-white p-3 transition active:scale-[0.99]"
    >
      <Icon kind="invoice" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text-primary">
          {item.name || item.invoice_number} · {formatCurrency(item.total)}
        </p>
        <p className="truncate text-sm text-text-secondary">
          {item.client?.name ?? "Unknown client"}
        </p>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <InvoiceBadge status={item.status} />
        {item.status !== "paid" && <MarkPaidButton invoiceId={item.id} />}
      </div>
    </Link>
  );
}

