import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getInvoice } from "@/lib/data";
import { InvoiceBadge } from "@/components/ui/Badge";
import { LinkButton } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LineItemsTable } from "@/components/modules/LineItemsTable";
import { InvoiceActions } from "@/components/modules/InvoiceActions";
import { formatDate } from "@/lib/format";
import { getUserTimezone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const [invoice, tz] = await Promise.all([
    getInvoice(user.id, params.id),
    getUserTimezone(),
  ]);
  if (!invoice) notFound();

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href="/invoices"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
          aria-label="Back"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold text-text-primary">
            {invoice.name || invoice.invoice_number}
          </h1>
          {invoice.name && (
            <p className="truncate text-xs text-text-secondary">
              {invoice.invoice_number}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <LinkButton href={`/invoices/${invoice.id}/edit`} variant="outline" size="sm">
            Edit
          </LinkButton>
          <InvoiceBadge status={invoice.status} />
        </div>
      </header>

      <Card>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-secondary">Client</dt>
            <dd className="font-medium text-text-primary">
              {invoice.client ? (
                <Link
                  href={`/clients/${invoice.client.id}`}
                  className="text-mint-dark"
                >
                  {invoice.client.name}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Due date</dt>
            <dd className="font-medium text-text-primary">
              {formatDate(invoice.due_date, tz)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Viewed by client</dt>
            <dd className="font-medium">
              {invoice.viewed_at ? (
                <span className="text-mint-dark">
                  ✓ {formatDate(invoice.viewed_at, tz)}
                </span>
              ) : (
                <span className="text-text-secondary">Not yet</span>
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Paid</dt>
            <dd className="font-medium text-text-primary">
              {formatDate(invoice.paid_at, tz)}
            </dd>
          </div>
          {invoice.estimate_id && (
            <div className="flex justify-between">
              <dt className="text-text-secondary">From estimate</dt>
              <dd>
                <Link
                  href={`/estimates/${invoice.estimate_id}`}
                  className="font-medium text-mint-dark"
                >
                  View
                </Link>
              </dd>
            </div>
          )}
        </dl>
      </Card>

      <LineItemsTable items={invoice.line_items} total={invoice.total} />

      <InvoiceActions invoiceId={invoice.id} status={invoice.status} />
    </div>
  );
}
