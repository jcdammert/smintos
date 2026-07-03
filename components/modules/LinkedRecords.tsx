import Link from "next/link";
import { EstimateBadge, InvoiceBadge, Badge } from "@/components/ui/Badge";
import { formatCurrency } from "@/lib/format";
import type { AppointmentStatus, EstimateStatus, InvoiceStatus } from "@/types";

type EstimateLink = { id: string; estimate_number: string; name: string | null; total: number; status: string };
type InvoiceLink = { id: string; invoice_number: string; name: string | null; total: number; status: string };
type AppointmentLink = { id: string; title: string; start_time: string; status: string; contact_name?: string | null };

interface Props {
  estimates?: EstimateLink[];
  invoices?: InvoiceLink[];
  appointments?: AppointmentLink[];
}

const APT_TONE: Record<string, "green" | "red" | "amber" | "neutral"> = {
  confirmed: "green",
  showed: "green",
  cancelled: "red",
  no_show: "red",
  unconfirmed: "amber",
  invalid: "neutral",
};

export function LinkedRecords({ estimates = [], invoices = [], appointments = [] }: Props) {
  const total = estimates.length + invoices.length + appointments.length;
  if (total === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-text-primary">Linked records</p>
      <div className="space-y-2">
        {estimates.map((e) => (
          <Link
            key={e.id}
            href={`/estimates/${e.id}`}
            className="flex items-center justify-between gap-3 rounded-card border border-line bg-white px-3 py-3 transition active:scale-[0.99]"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">Estimate</p>
              <p className="truncate font-semibold text-text-primary">
                {e.name || e.estimate_number} · {formatCurrency(e.total)}
              </p>
            </div>
            <EstimateBadge status={e.status as EstimateStatus} />
          </Link>
        ))}

        {invoices.map((i) => (
          <Link
            key={i.id}
            href={`/invoices/${i.id}`}
            className="flex items-center justify-between gap-3 rounded-card border border-line bg-white px-3 py-3 transition active:scale-[0.99]"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">Invoice</p>
              <p className="truncate font-semibold text-text-primary">
                {i.name || i.invoice_number} · {formatCurrency(i.total)}
              </p>
            </div>
            <InvoiceBadge status={i.status as InvoiceStatus} />
          </Link>
        ))}

        {appointments.map((a) => (
          <Link
            key={a.id}
            href={`/appointments/${a.id}`}
            className="flex items-center justify-between gap-3 rounded-card border border-line bg-white px-3 py-3 transition active:scale-[0.99]"
          >
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-wide text-text-secondary">Appointment</p>
              <p className="truncate font-semibold text-text-primary">{a.title}</p>
              <p className="truncate text-xs text-text-secondary">
                {new Date(a.start_time).toLocaleDateString([], { dateStyle: "medium" })}
                {a.contact_name ? ` · ${a.contact_name}` : ""}
              </p>
            </div>
            <Badge tone={APT_TONE[a.status] ?? "neutral"}>
              {a.status.replace("_", " ")}
            </Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
