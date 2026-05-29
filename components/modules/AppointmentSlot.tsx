import { formatTime } from "@/lib/format";
import type { WithClient, Appointment } from "@/types";

export function AppointmentSlot({ item }: { item: WithClient<Appointment> }) {
  return (
    <div className="flex items-stretch gap-3 rounded-card border border-line bg-white p-3">
      <div className="flex w-14 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-bg">
        <span className="text-sm font-bold text-text-primary">
          {formatTime(item.scheduled_at)}
        </span>
        <span className="text-[10px] text-text-secondary">
          {item.duration_minutes}m
        </span>
      </div>
      <div className="h-auto w-1 rounded-full bg-mint" />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="truncate font-semibold text-text-primary">{item.title}</p>
        <p className="truncate text-sm text-text-secondary">
          {item.client?.name ?? "—"}
          {item.assigned_to ? ` · ${item.assigned_to}` : ""}
        </p>
        {item.notes && (
          <p className="mt-1 truncate text-xs text-text-secondary">{item.notes}</p>
        )}
      </div>
    </div>
  );
}
