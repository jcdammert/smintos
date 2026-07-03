"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateAppointmentAction } from "@/lib/actions";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Appointment } from "@/types";

function toLocalDatetime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function AppointmentEditForm({ apt }: { apt: Appointment }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [startVal, setStartVal] = useState(toLocalDatetime(apt.start_time));
  const [endVal,   setEndVal]   = useState(toLocalDatetime(apt.end_time));

  const pad = (n: number) => String(n).padStart(2, "0");

  function handleStartChange(newStart: string) {
    setStartVal(newStart);
    const prevDuration = Math.max(
      (new Date(endVal).getTime() - new Date(startVal).getTime()) / 60000,
      60,
    );
    const newEnd = new Date(new Date(newStart).getTime() + prevDuration * 60000);
    setEndVal(
      `${newEnd.getFullYear()}-${pad(newEnd.getMonth() + 1)}-${pad(newEnd.getDate())}T${pad(newEnd.getHours())}:${pad(newEnd.getMinutes())}`,
    );
  }

  function handleSubmit(fd: FormData) {
    setError(null);
    start(async () => {
      const res = await updateAppointmentAction(apt.id, fd);
      if (!res.ok) { setError(res.error ?? "Something went wrong."); return; }
      router.push(`/appointments/${apt.id}`);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      <Input
        id="contact_name" name="contact_name" label="Contact name"
        defaultValue={apt.contact_name ?? ""}
        placeholder="Jane Smith"
      />
      <Input
        id="job_type" name="job_type" label="Job type"
        defaultValue={apt.job_type ?? ""}
        placeholder="Auto tint, Residential…"
      />
      <Input
        id="title" name="title" label="Job title (optional)"
        defaultValue={apt.title}
        placeholder="Leave blank to auto-set from contact name"
      />
      <Input
        id="address" name="address" label="Job address"
        defaultValue={apt.address ?? ""}
        placeholder="123 Main St, City, State"
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          id="start_time" name="start_time" type="datetime-local" label="Start"
          value={startVal} onChange={(e) => handleStartChange(e.target.value)} required
        />
        <Input
          id="end_time" name="end_time" type="datetime-local" label="End"
          value={endVal} onChange={(e) => setEndVal(e.target.value)} required
        />
      </div>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-text-primary">Status</span>
        <select
          name="status"
          defaultValue={apt.status}
          className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30"
        >
          <option value="unconfirmed">Unconfirmed</option>
          <option value="confirmed">Confirmed</option>
          <option value="showed">Showed</option>
          <option value="no_show">No Show</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>

      <Input
        id="assigned_to" name="assigned_to" label="Assigned to"
        defaultValue={apt.assigned_to ?? ""}
        placeholder="Crew member name"
      />
      <Textarea
        id="notes" name="notes" label="Notes"
        defaultValue={apt.notes ?? ""}
        placeholder="Optional job notes…"
      />

      {error && (
        <p className="rounded-card bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}
