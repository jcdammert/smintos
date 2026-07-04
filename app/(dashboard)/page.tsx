import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import {
  getEstimates,
  getInvoices,
  getTodayAppointments,
} from "@/lib/data";
import { getUserTimezone } from "@/lib/timezone";
import { greeting, formatCurrency } from "@/lib/format";
import { SectionHeader, EmptyState } from "@/components/ui/Card";
import {
  EstimatePipelineCard,
  InvoicePipelineCard,
} from "@/components/modules/PipelineCard";
import { SyncAllButton } from "@/components/modules/SyncAllButton";
import type { AppointmentStatus } from "@/types";

export const dynamic = "force-dynamic";

const STATUS_DOT: Record<AppointmentStatus, string> = {
  confirmed:   "bg-mint-dark",
  showed:      "bg-blue-500",
  cancelled:   "bg-red-500",
  no_show:     "bg-orange-500",
  unconfirmed: "bg-gray-400",
  invalid:     "bg-gray-400",
};

const STATUS_LABEL: Record<AppointmentStatus, string> = {
  confirmed:   "Confirmed",
  showed:      "Showed",
  cancelled:   "Cancelled",
  no_show:     "No Show",
  unconfirmed: "Unconfirmed",
  invalid:     "Invalid",
};

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

  const [estimates, invoices, todayJobs, tz] = await Promise.all([
    getEstimates(user.id),
    getInvoices(user.id),
    getTodayAppointments(user.id),
    getUserTimezone(),
  ]);

  const estimatesOut = estimates.filter((e) => e.status === "sent").length;
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

      {/* 2. Stat pills */}
      <section className="grid grid-cols-3 gap-2">
        <StatPill label="Estimates out" value={estimatesOut} />
        <StatPill label="Jobs today" value={todayJobs.length} />
        <StatPill label="Overdue" value={overdueInvoices.length} danger />
      </section>

      {/* 3. Sync button */}
      <SyncAllButton />

      {/* 4. Today's Jobs */}
      <section>
        <SectionHeader
          title="Today's Jobs"
          action={
            <Link href="/calendar" className="text-sm font-semibold text-mint-dark">
              View Calendar →
            </Link>
          }
        />
        {todayJobs.length > 0 ? (
          <div className="space-y-2">
            {todayJobs.map((job) => {
              const dot = STATUS_DOT[job.status] ?? "bg-gray-400";
              const label = STATUS_LABEL[job.status] ?? job.status;
              const startTime = new Date(job.start_time).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              });
              return (
                <Link
                  key={job.id}
                  href={`/calendar?job=${job.id}`}
                  className="flex items-center gap-3 rounded-card border border-line bg-white p-3 transition active:scale-[0.99]"
                >
                  <div className={`h-10 w-1.5 flex-shrink-0 rounded-full ${dot}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text-primary">{job.title}</p>
                    <p className="truncate text-sm text-text-secondary">
                      {job.contact_name ?? "—"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-semibold text-text-primary">{startTime}</span>
                    <span className="text-[10px] text-text-secondary">{label}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No jobs scheduled today" />
        )}
      </section>

      {/* 4. Active pipeline */}
      <section>
        <SectionHeader
          title="Active Pipeline"
          action={
            <Link href="/library?tab=estimates" className="text-sm font-semibold text-mint-dark">
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

      {/* footer */}
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
