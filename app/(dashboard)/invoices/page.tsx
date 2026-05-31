import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getInvoices } from "@/lib/data";
import { InvoiceBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Card";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function InvoicesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const invoices = await getInvoices(user.id);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Invoices
        </h1>
      </header>

      {invoices.length ? (
        <div className="space-y-2">
          {invoices.map((i) => (
            <Link
              key={i.id}
              href={`/invoices/${i.id}`}
              className="flex items-center gap-3 rounded-card border border-line bg-white p-3 transition active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-text-primary">
                  {i.name || i.invoice_number} · {formatCurrency(i.total)}
                </p>
                <p className="truncate text-sm text-text-secondary">
                  {i.client?.name ?? "—"} · due {formatDate(i.due_date)}
                  {i.viewed_at && (
                    <span className="ml-2 text-mint-dark">· 👁 Viewed</span>
                  )}
                </p>
              </div>
              <InvoiceBadge status={i.status} />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No invoices yet"
          subtitle="Approve an estimate and convert it to create your first invoice."
        />
      )}
    </div>
  );
}
