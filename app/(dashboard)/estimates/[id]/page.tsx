import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getEstimate } from "@/lib/data";
import { EstimateBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { LineItemsTable } from "@/components/modules/LineItemsTable";
import { EstimateActions } from "@/components/modules/EstimateActions";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EstimateDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const estimate = await getEstimate(user.id, params.id);
  if (!estimate) notFound();

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href="/estimates"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
          aria-label="Back"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold text-text-primary">
            {estimate.name || estimate.estimate_number}
          </h1>
          {estimate.name && (
            <p className="truncate text-xs text-text-secondary">
              {estimate.estimate_number}
            </p>
          )}
        </div>
        <EstimateBadge status={estimate.status} />
      </header>

      <Card>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-secondary">Client</dt>
            <dd className="font-medium text-text-primary">
              {estimate.client ? (
                <Link
                  href={`/clients/${estimate.client.id}`}
                  className="text-mint-dark"
                >
                  {estimate.client.name}
                </Link>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Created</dt>
            <dd className="font-medium text-text-primary">
              {formatDate(estimate.created_at)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Sent</dt>
            <dd className="font-medium text-text-primary">
              {formatDate(estimate.sent_at)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">Viewed by client</dt>
            <dd className="font-medium">
              {estimate.viewed_at ? (
                <span className="text-mint-dark">
                  ✓ {formatDate(estimate.viewed_at)}
                </span>
              ) : (
                <span className="text-text-secondary">Not yet</span>
              )}
            </dd>
          </div>
        </dl>
      </Card>

      <LineItemsTable items={estimate.line_items} total={estimate.total} />

      <EstimateActions estimateId={estimate.id} status={estimate.status} />
    </div>
  );
}
