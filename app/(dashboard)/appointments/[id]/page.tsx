import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getAppointment, getLinkedRecordsForAppointment } from "@/lib/data";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { LinkedRecords } from "@/components/modules/LinkedRecords";
import { AppointmentConvertButton } from "@/components/modules/AppointmentConvertButton";

export const dynamic = "force-dynamic";

const STATUS_TONE = {
  confirmed: "green",
  showed: "green",
  cancelled: "red",
  no_show: "red",
  unconfirmed: "amber",
  invalid: "neutral",
} as const;

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  showed: "Showed",
  cancelled: "Cancelled",
  no_show: "No Show",
  unconfirmed: "Unconfirmed",
  invalid: "Invalid",
};

export default async function AppointmentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const apt = await getAppointment(user.id, params.id);
  if (!apt) notFound();

  const linked = await getLinkedRecordsForAppointment(
    user.id,
    apt.id,
    apt.estimate_id ?? null,
  );
  const hasInvoice = linked.invoices.length > 0;

  const tone = STATUS_TONE[apt.status] ?? "neutral";
  const mapsHref = apt.address
    ? `https://maps.google.com/?q=${encodeURIComponent(apt.address)}`
    : null;

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href="/calendar"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
          aria-label="Back to calendar"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-2xl font-bold text-text-primary">
            {apt.title}
          </h1>
          {apt.contact_name && (
            <p className="truncate text-xs text-text-secondary">{apt.contact_name}</p>
          )}
        </div>
        <Badge tone={tone}>{STATUS_LABEL[apt.status] ?? apt.status}</Badge>
      </header>

      <Card>
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-text-secondary">Start</dt>
            <dd className="font-medium text-text-primary">
              {new Date(apt.start_time).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-text-secondary">End</dt>
            <dd className="font-medium text-text-primary">
              {new Date(apt.end_time).toLocaleString([], {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </dd>
          </div>
          {apt.contact_name && (
            <div className="flex justify-between">
              <dt className="text-text-secondary">Contact</dt>
              <dd className="font-medium text-text-primary">{apt.contact_name}</dd>
            </div>
          )}
          {apt.job_type && (
            <div className="flex justify-between">
              <dt className="text-text-secondary">Job type</dt>
              <dd className="font-medium text-text-primary">{apt.job_type}</dd>
            </div>
          )}
          {apt.address && (
            <div className="flex justify-between gap-4">
              <dt className="flex-shrink-0 text-text-secondary">Address</dt>
              <dd className="text-right">
                {mapsHref ? (
                  <a
                    href={mapsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-mint-dark"
                  >
                    {apt.address}
                  </a>
                ) : (
                  <span className="font-medium text-text-primary">{apt.address}</span>
                )}
              </dd>
            </div>
          )}
          {apt.notes && (
            <div className="flex justify-between gap-4">
              <dt className="flex-shrink-0 text-text-secondary">Notes</dt>
              <dd className="text-right font-medium text-text-primary">{apt.notes}</dd>
            </div>
          )}
          {apt.assigned_to && (
            <div className="flex justify-between">
              <dt className="text-text-secondary">Assigned to</dt>
              <dd className="font-medium text-text-primary">{apt.assigned_to}</dd>
            </div>
          )}
        </dl>
      </Card>

      <AppointmentConvertButton appointmentId={apt.id} hasInvoice={hasInvoice} />

      <LinkedRecords
        estimates={linked.estimate ? [linked.estimate] : []}
        invoices={linked.invoices}
      />
    </div>
  );
}
