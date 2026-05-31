import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import {
  getEstimates,
  getInvoices,
  getAppointments,
  getClients,
  isToday,
} from "@/lib/data";
import { greeting, formatTime, formatCurrency } from "@/lib/format";
import { SectionHeader, EmptyState } from "@/components/ui/Card";
import {
  EstimatePipelineCard,
  InvoicePipelineCard,
  AppointmentPipelineCard,
} from "@/components/modules/PipelineCard";

// Always render fresh data; refresh on navigation/focus.
export const dynamic = "force-dynamic";

export default async function DashboardHome() {
  const user = await getCurrentUser();
  const name = user?.business_name || user?.email?.split("@")[0] || "there";

  if (!user) {
    return (
      <EmptyState
        title="Session expired"
        subtitle="Please sign in again."
        action={
          <Link href="/login" className="text-mint font-semibold">
            Go to login
          </Link>
        }
      />
    );
  }

  const [estimates, invoices, appointments, clients] = await Promise.all([
    getEstimates(user.id),
    getInvoices(user.id),
    getAppointments(user.id),
    getClients(user.id),
  ]);
  const clientsCount = clients.length;

  const estimatesOut = estimates.filter((e) => e.status === "sent").length;
  const todaysAppointments = appointments.filter((a) =>
    isToday(a.scheduled_at),
  );
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");

  const approvedEstimates = estimates.filter((e) => e.status === "approved");
  const openInvoices = invoices.filter((i) => i.status !== "paid");

  const hasPipeline =
    approvedEstimates.length > 0 ||
    openInvoices.length > 0 ||
    estimates.filter((e) => e.status === "sent").length > 0;

  return (
    <div className="space-y-6">
      {/* 1. Top bar */}
      <header className="flex items-center justify-between pt-2">
        <div>
          <p className="text-sm text-text-secondary">{greeting()},</p>
          <h1 className="font-display text-2xl font-bold capitalize text-text-primary">
            {name}
          </h1>
        </div>
        <button
          aria-label="Notifications"
          className="relative flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-text-primary" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 8a6 6 0 1112 0c0 7 3 7 3 9H3c0-2 3-2 3-9z" strokeLinejoin="round" />
            <path d="M10 21a2 2 0 004 0" strokeLinecap="round" />
          </svg>
          {overdueInvoices.length > 0 && (
            <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-danger" />
          )}
        </button>
      </header>

      {/* 2. Pipeline strip — clean light cards with mint accents */}
      <section className="grid grid-cols-3 gap-2">
        <StatPill label="Estimates out" value={estimatesOut} />
        <StatPill label="Jobs today" value={todaysAppointments.length} />
        <StatPill label="Overdue" value={overdueInvoices.length} danger />
      </section>

      {/* 3. Quick action row — creating new things only */}
      <section className="grid grid-cols-3 gap-2">
        <QuickAction href="/estimates/new" label="Estimate" primary />
        <QuickAction href="/clients/new" label="Client" />
        <QuickAction href="/schedule" label="Appointment" />
      </section>

      {/* 4. Your Library — browse everything in one glance */}
      <section>
        <SectionHeader title="Your Library" />
        <div className="grid grid-cols-3 gap-2">
          <LibraryTile
            href="/clients"
            label="Clients"
            count={
              // counted server-side from the clients query in the dashboard
              clientsCount
            }
          />
          <LibraryTile
            href="/estimates"
            label="Estimates"
            count={estimates.length}
          />
          <LibraryTile
            href="/invoices"
            label="Invoices"
            count={invoices.length}
          />
        </div>
      </section>

      {/* 5. Active pipeline */}
      <section>
        <SectionHeader
          title="Active Pipeline"
          action={
            <Link href="/estimates" className="text-sm font-semibold text-mint-dark">
              View all
            </Link>
          }
        />
        {hasPipeline ? (
          <div className="space-y-2">
            {approvedEstimates.map((e) => (
              <EstimatePipelineCard key={e.id} item={e} />
            ))}
            {estimates
              .filter((e) => e.status === "sent")
              .map((e) => (
                <EstimatePipelineCard key={e.id} item={e} />
              ))}
            {openInvoices.map((i) => (
              <InvoicePipelineCard key={i.id} item={i} />
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nothing in the pipeline yet"
            subtitle="Create an estimate to get the ball rolling."
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
      </section>

      {/* 5. Today's schedule */}
      <section>
        <SectionHeader
          title="Today's Schedule"
          action={
            <Link href="/schedule" className="text-sm font-semibold text-mint-dark">
              Full schedule
            </Link>
          }
        />
        {todaysAppointments.length > 0 ? (
          <div className="space-y-2">
            {todaysAppointments.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-card border border-line bg-white p-3"
              >
                <div className="h-10 w-1.5 rounded-full bg-mint" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-text-primary">
                    {a.title}
                  </p>
                  <p className="truncate text-sm text-text-secondary">
                    {a.client?.name ?? "—"}
                    {a.assigned_to ? ` · ${a.assigned_to}` : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold text-text-primary">
                  {formatTime(a.scheduled_at)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No jobs scheduled today" />
        )}
      </section>

      {/* 6. Messages preview */}
      <section>
        <SectionHeader title="Messages" />
        <div className="rounded-card border border-line bg-white p-4 text-center text-sm text-text-secondary">
          Connect GoHighLevel in{" "}
          <Link href="/settings" className="font-semibold text-mint-dark">
            Settings
          </Link>{" "}
          to see SMS threads here.
        </div>
      </section>

      {/* lifetime total footer */}
      <p className="pb-2 text-center text-xs text-text-secondary">
        {invoices.filter((i) => i.status === "paid").length} jobs closed ·{" "}
        {formatCurrency(
          invoices
            .filter((i) => i.status === "paid")
            .reduce((s, i) => s + Number(i.total), 0),
        )}{" "}
        collected
      </p>
    </div>
  );
}

function StatPill({
  label,
  value,
  danger,
}: {
  label: string;
  value: number;
  danger?: boolean;
}) {
  return (
    <div className="rounded-card border border-line bg-white p-3">
      <p
        className={`font-display text-2xl font-bold ${
          danger && value > 0 ? "text-danger" : "text-mint-dark"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-tight text-text-secondary">
        {label}
      </p>
    </div>
  );
}

function QuickAction({
  href,
  label,
  primary,
}: {
  href: string;
  label: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-card border p-2 text-center text-xs font-semibold transition active:scale-95 ${
        primary
          ? "border-mint bg-mint text-ink"
          : "border-line bg-white text-text-primary"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
      {label}
    </Link>
  );
}

function LibraryTile({
  href,
  label,
  count,
}: {
  href: string;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-[80px] flex-col items-start justify-between rounded-card border border-line bg-white p-3 transition active:scale-[0.98]"
    >
      <span className="font-display text-2xl font-bold text-text-primary">
        {count}
      </span>
      <span className="text-xs font-semibold text-text-secondary">
        {label}
      </span>
    </Link>
  );
}
