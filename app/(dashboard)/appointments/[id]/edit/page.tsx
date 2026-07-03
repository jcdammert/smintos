import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getAppointment } from "@/lib/data";
import { AppointmentEditForm } from "@/components/modules/AppointmentEditForm";

export const dynamic = "force-dynamic";

export default async function EditAppointmentPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const apt = await getAppointment(user.id, params.id);
  if (!apt) notFound();

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href={`/appointments/${apt.id}`}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Edit appointment
        </h1>
      </header>

      <AppointmentEditForm apt={apt} />
    </div>
  );
}
