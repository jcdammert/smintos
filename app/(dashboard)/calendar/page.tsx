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

  const todayStr = today.toISOString().split("T")[0];

  return (
    <Suspense>
      <CalendarView initialAppointments={appointments} today={todayStr} />
    </Suspense>
  );
}
