"use client";

import { useState, useTransition } from "react";
import { createCalendarAppointmentAction } from "@/lib/actions";
import { Modal } from "@/components/ui/Modal";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Client } from "@/types";

export function AppointmentForm({
  clients,
  defaultClientId,
}: {
  clients: Client[];
  defaultClientId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>
        + Schedule
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="New appointment">
        {clients.length === 0 ? (
          <p className="text-sm text-text-secondary">
            Add a client first to schedule an appointment.
          </p>
        ) : (
          <form
            action={(fd) => start(async () => { await createCalendarAppointmentAction(fd); })}
            className="space-y-4"
          >
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-text-primary">
                Client
              </span>
              <select
                name="client_id"
                defaultValue={defaultClientId ?? ""}
                required
                className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base outline-none focus:border-mint focus:ring-2 focus:ring-mint/30"
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <Input
              id="title"
              name="title"
              label="Job title"
              required
              placeholder="HVAC tune-up"
            />
            <Input
              id="scheduled_at"
              name="scheduled_at"
              type="datetime-local"
              label="Date & time"
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                id="duration_minutes"
                name="duration_minutes"
                type="number"
                min={15}
                step={15}
                defaultValue={60}
                label="Minutes"
              />
              <Input
                id="assigned_to"
                name="assigned_to"
                label="Crew"
                placeholder="Optional"
              />
            </div>
            <Textarea id="notes" name="notes" label="Notes" placeholder="Optional" />

            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Scheduling…" : "Schedule appointment"}
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
