import type { Appointment, AppointmentStatus } from "@/types";

const STATUS_BAR: Record<AppointmentStatus, string> = {
  confirmed:   "bg-mint-dark",
  showed:      "bg-blue-500",
  cancelled:   "bg-red-500",
  no_show:     "bg-orange-500",
  unconfirmed: "bg-gray-400",
  invalid:     "bg-gray-400",
};

export function AppointmentSlot({ item }: { item: Appointment }) {
  const bar = STATUS_BAR[item.status] ?? "bg-gray-400";
  const start = new Date(item.start_time).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  const end = new Date(item.end_time).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="flex items-stretch gap-3 rounded-card border border-line bg-white p-3">
      <div className={`flex-shrink-0 w-1.5 rounded-full ${bar}`} />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="truncate font-semibold text-text-primary">{item.title}</p>
        <p className="truncate text-sm text-text-secondary">
          {item.contact_name ?? "—"}
          {item.job_type ? ` · ${item.job_type}` : ""}
        </p>
        {item.notes && (
          <p className="mt-1 truncate text-xs text-text-secondary">{item.notes}</p>
        )}
      </div>
      <div className="flex flex-col items-end justify-center gap-0.5">
        <span className="text-sm font-semibold text-text-primary">{start}</span>
        <span className="text-xs text-text-secondary">{end}</span>
      </div>
    </div>
  );
}
