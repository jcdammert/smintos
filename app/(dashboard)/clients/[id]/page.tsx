import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import {
  getClient,
  getEstimatesForClient,
  getInvoicesForClient,
  getNotes,
} from "@/lib/data";
import { Card, SectionHeader, EmptyState } from "@/components/ui/Card";
import { EstimateBadge, InvoiceBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { NotesSection } from "@/components/modules/NotesSection";
import { formatCurrency, formatDate } from "@/lib/format";
import { getUserTimezone } from "@/lib/timezone";

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

  const [estimates, invoices, notes, tz] = await Promise.all([
    getEstimatesForClient(user.id, client.id),
    getInvoicesForClient(user.id, client.id),
    getNotes(user.id, client.id),
    getUserTimezone(),
  ]);

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
        <h1 className="min-w-0 flex-1 truncate font-display text-2xl font-bold text-text-primary">
          {client.name}
        </h1>
        <LinkButton
          href={`/clients/${client.id}/edit`}
          variant="outline"
          size="sm"
        >
          Edit
        </LinkButton>
      </header>

      <Card>
        <dl className="space-y-2 text-sm">
          <Row label="Phone" value={client.phone} />
          <Row label="Email" value={client.email} />
          <Row label="Street" value={client.address} />
          <Row label="City" value={client.city} />
          <Row label="State" value={client.state} />
          <Row label="Zip" value={client.postal_code} />
          <Row label="Country" value={client.country} />
          <Row
            label="GHL contact"
            value={client.ghl_contact_id ? "Synced ✓" : "Not synced"}
          />
        </dl>
      </Card>

      <div className="grid grid-cols-3 gap-2">
        <LinkButton href={`/estimates/new?client=${client.id}`} size="sm">
          + Estimate
        </LinkButton>
        <LinkButton href={`/invoices/new?client=${client.id}`} size="sm" variant="outline">
          + Invoice
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
                className="flex items-center justify-between gap-3 rounded-card border border-line bg-white p-3 transition active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-text-primary">
                    {e.name || e.estimate_number} · {formatCurrency(e.total)}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {formatDate(e.created_at, tz)}
                    {e.viewed_at ? " · 👁 Viewed" : ""}
                  </p>
                </div>
                <EstimateBadge status={e.status} />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title="No estimates" />
        )}
      </section>

      <NotesSection clientId={client.id} notes={notes} tz={tz} />

      <section>
        <SectionHeader title="Invoices" />
        {invoices.length ? (
          <div className="space-y-2">
            {invoices.map((i) => (
              <Link
                key={i.id}
                href={`/invoices/${i.id}`}
                className="flex items-center justify-between gap-3 rounded-card border border-line bg-white p-3 transition active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-text-primary">
                    {i.name || i.invoice_number} · {formatCurrency(i.total)}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {i.status === "paid" && i.paid_at
                      ? `Paid ${formatDate(i.paid_at, tz)}`
                      : `Due ${formatDate(i.due_date, tz)}`}
                    {i.viewed_at ? " · 👁 Viewed" : ""}
                  </p>
                </div>
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
