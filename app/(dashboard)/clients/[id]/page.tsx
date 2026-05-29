import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getClient, getEstimates, getInvoices } from "@/lib/data";
import { Card, SectionHeader, EmptyState } from "@/components/ui/Card";
import { EstimateBadge, InvoiceBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ClientDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const client = await getClient(user.id, params.id);
  if (!client) notFound();

  const [allEstimates, allInvoices] = await Promise.all([
    getEstimates(user.id),
    getInvoices(user.id),
  ]);
  const estimates = allEstimates.filter((e) => e.client_id === client.id);
  const invoices = allInvoices.filter((i) => i.client_id === client.id);

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href="/clients"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="truncate font-display text-2xl font-bold text-text-primary">
          {client.name}
        </h1>
      </header>

      <Card>
        <dl className="space-y-2 text-sm">
          <Row label="Phone" value={client.phone} />
          <Row label="Email" value={client.email} />
          <Row label="Address" value={client.address} />
          <Row
            label="GHL contact"
            value={client.ghl_contact_id ? "Synced" : "Not synced"}
          />
        </dl>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        <LinkButton href={`/estimates/new?client=${client.id}`} size="sm">
          + Estimate
        </LinkButton>
        <LinkButton
          href={`/schedule?client=${client.id}`}
          variant="outline"
          size="sm"
        >
          Schedule
        </LinkButton>
      </div>

      <section>
        <SectionHeader title="Estimates" />
        {estimates.length ? (
          <div className="space-y-2">
            {estimates.map((e) => (
              <Link
                key={e.id}
                href={`/estimates/${e.id}`}
                className="flex items-center justify-between rounded-card border border-line bg-white p-3"
              >
                <span className="font-semibold text-text-primary">
                  {e.estimate_number} · {formatCurrency(e.total)}
                </span>
                <EstimateBadge status={e.status} />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No estimates" />
        )}
      </section>

      <section>
        <SectionHeader title="Invoices" />
        {invoices.length ? (
          <div className="space-y-2">
            {invoices.map((i) => (
              <Link
                key={i.id}
                href={`/invoices/${i.id}`}
                className="flex items-center justify-between rounded-card border border-line bg-white p-3"
              >
                <span className="font-semibold text-text-primary">
                  {i.invoice_number} · {formatCurrency(i.total)}
                </span>
                <InvoiceBadge status={i.status} />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No invoices" />
        )}
      </section>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-text-secondary">{label}</dt>
      <dd className="text-right font-medium text-text-primary">
        {value || "—"}
      </dd>
    </div>
  );
}
