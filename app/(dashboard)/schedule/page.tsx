import { getCurrentUser } from "@/lib/session";
import { getAppointments, getClients } from "@/lib/data";
import { AppointmentSlot } from "@/components/modules/AppointmentSlot";
import { AppointmentForm } from "@/components/modules/AppointmentForm";
import { EmptyState } from "@/components/ui/Card";
import { formatDate } from "@/lib/format";
import type { WithClient, Appointment } from "@/types";

export const dynamic = "force-dynamic";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: { client?: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const [appointments, clients] = await Promise.all([
    getAppointments(user.id),
    getClients(user.id),
  ]);

  // Group upcoming appointments by day for a simple agenda view.
  const now = Date.now();
  const upcoming = appointments.filter(
    (a) => new Date(a.scheduled_at).getTime() >= now - 86400000,
  );

  const groups = new Map<string, WithClient<Appointment>[]>();
  for (const appt of upcoming) {
    const key = formatDate(appt.scheduled_at);
    const list = groups.get(key) ?? [];
    list.push(appt);
    groups.set(key, list);
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Schedule
        </h1>
        <AppointmentForm clients={clients} defaultClientId={searchParams.client} />
      </header>

      {upcoming.length ? (
        <div className="space-y-5">
          {Array.from(groups.entries()).map(([day, items]) => (
            <section key={day}>
              <h2 className="mb-2 text-sm font-semibold text-text-secondary">
                {day}
              </h2>
              <div className="space-y-2">
                {items.map((a) => (
                  <AppointmentSlot key={a.id} item={a} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No upcoming appointments"
          subtitle="Schedule a job and it syncs to your GoHighLevel calendar."
        />
      )}
    </div>
  );
}
