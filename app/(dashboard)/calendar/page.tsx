import { Suspense } from "react";
import { getCurrentUser } from "@/lib/session";
import { getCalendarAppointments } from "@/lib/data";
import { CalendarView } from "@/components/modules/CalendarView";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  // Initial load: full current week
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const appointments = await getCalendarAppointments(
    user.id,
    weekStart.toISOString(),
    weekEnd.toISOString(),
  );

  // Use local date parts so the calendar opens on the correct day in the user's timezone
  const pad = (n: number) => String(n).padStart(2, "0");
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  return (
    <Suspense>
      <CalendarView initialAppointments={appointments} today={todayStr} />
    </Suspense>
  );
}
