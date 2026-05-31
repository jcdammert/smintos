import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getEstimates } from "@/lib/data";
import { getUserTimezone } from "@/lib/timezone";
import { EstimateBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function EstimatesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [estimates, tz] = await Promise.all([
    getEstimates(user.id),
    getUserTimezone(),
  ]);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Estimates
        </h1>
        <LinkButton href="/estimates/new" size="sm">
          + New
        </LinkButton>
      </header>

      {estimates.length ? (
        <div className="space-y-2">
          {estimates.map((e) => (
            <Link
              key={e.id}
              href={`/estimates/${e.id}`}
              className="flex items-center gap-3 rounded-card border border-line bg-white p-3 transition active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-text-primary">
                  {e.name || e.estimate_number} · {formatCurrency(e.total)}
                </p>
                <p className="truncate text-sm text-text-secondary">
                  {e.client?.name ?? "—"} · {formatDate(e.created_at, tz)}
                  {e.viewed_at && (
                    <span className="ml-2 text-mint-dark">· 👁 Viewed</span>
                  )}
                </p>
              </div>
              <EstimateBadge status={e.status} />
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No estimates yet"
          subtitle="Build your first estimate and send it in seconds."
          action={
            <Link
              href="/estimates/new"
              className="rounded-card bg-mint px-5 py-3 text-sm font-semibold text-ink"
            >
              New estimate
            </Link>
          }
        />
      )}
    </div>
  );
}
