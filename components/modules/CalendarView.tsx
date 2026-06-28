"use client";

import {
  useState,
  useEffect,
  useRef,
  useTransition,
  useCallback,
} from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  createCalendarAppointmentAction,
  fetchCalendarRangeAction,
} from "@/lib/actions";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import type { Appointment, AppointmentStatus } from "@/types";

// ─── Constants ─────────────────────────────────────────────────────────────

const START_HOUR = 7;
const END_HOUR = 20;
const HOUR_HEIGHT = 64; // px per hour
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

const STATUS_CFG: Record<
  AppointmentStatus,
  { bg: string; border: string; text: string; badge: string; label: string }
> = {
  confirmed:   { bg: "bg-mint/10",    border: "border-l-mint-dark", text: "text-mint-dark",   badge: "bg-mint/20 text-mint-dark",    label: "Confirmed"   },
  showed:      { bg: "bg-blue-50",    border: "border-l-blue-500",  text: "text-blue-700",    badge: "bg-blue-100 text-blue-700",    label: "Showed"      },
  cancelled:   { bg: "bg-red-50",     border: "border-l-red-500",   text: "text-red-700",     badge: "bg-red-100 text-red-700",      label: "Cancelled"   },
  no_show:     { bg: "bg-orange-50",  border: "border-l-orange-500",text: "text-orange-700",  badge: "bg-orange-100 text-orange-700",label: "No Show"     },
  unconfirmed: { bg: "bg-gray-50",    border: "border-l-gray-400",  text: "text-gray-600",    badge: "bg-gray-100 text-gray-600",    label: "Unconfirmed" },
  invalid:     { bg: "bg-gray-50",    border: "border-l-gray-400",  text: "text-gray-600",    badge: "bg-gray-100 text-gray-600",    label: "Invalid"     },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function addDays(d: Date, n: number) {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

function getWeekStart(d: Date) {
  const c = new Date(d);
  c.setDate(c.getDate() - c.getDay()); // Sunday
  c.setHours(0, 0, 0, 0);
  return c;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function getApptsForDay(apts: Appointment[], day: Date) {
  return apts.filter((a) => isSameDay(new Date(a.start_time), day));
}

function posStyle(apt: Appointment): { top: number; height: number } {
  const s = new Date(apt.start_time);
  const e = new Date(apt.end_time);
  const startMin = s.getHours() * 60 + s.getMinutes();
  const endMin = e.getHours() * 60 + e.getMinutes();
  const gridStartMin = START_HOUR * 60;
  const top = Math.max(0, (startMin - gridStartMin) * (HOUR_HEIGHT / 60));
  const height = Math.max(24, (endMin - startMin) * (HOUR_HEIGHT / 60));
  return { top, height };
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtDateHeader(d: Date) {
  return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

function fmtDayShort(d: Date) {
  return d.toLocaleDateString([], { weekday: "short" });
}

function fmtDayNum(d: Date) {
  return d.getDate();
}

function toLocalDatetimeValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ─── Sub-components ────────────────────────────────────────────────────────

function TimeLabel({ hour }: { hour: number }) {
  if (hour === END_HOUR) return null;
  return (
    <div
      className="absolute left-0 right-0 flex items-start pl-1"
      style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
    >
      <span className="text-[10px] leading-none text-text-secondary">
        {hour === 12 ? "12pm" : hour < 12 ? `${hour}am` : `${hour - 12}pm`}
      </span>
    </div>
  );
}

function HourLine({ hour }: { hour: number }) {
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 border-t border-line/50"
      style={{ top: (hour - START_HOUR) * HOUR_HEIGHT }}
    />
  );
}

function JobBlock({
  apt,
  onClick,
}: {
  apt: Appointment;
  onClick: () => void;
}) {
  const { top, height } = posStyle(apt);
  const cfg = STATUS_CFG[apt.status] ?? STATUS_CFG.unconfirmed;
  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute left-0 right-0.5 rounded-r-lg border-l-[3px] px-1.5 py-0.5 text-left ${cfg.bg} ${cfg.border} transition active:opacity-70`}
      style={{ top, height, minHeight: 24 }}
    >
      <p className={`truncate text-xs font-semibold leading-tight ${cfg.text}`}>
        {apt.contact_name || apt.title}
      </p>
      {height >= 40 && (
        <p className={`truncate text-[10px] leading-tight ${cfg.text} opacity-70`}>
          {apt.job_type ? `${apt.job_type} · ` : ""}{fmtTime(apt.start_time)}
        </p>
      )}
    </button>
  );
}

function DayColumn({
  day,
  apts,
  onSelect,
}: {
  day: Date;
  apts: Appointment[];
  onSelect: (a: Appointment) => void;
}) {
  return (
    <div className="relative flex-1 min-w-[72px] border-r border-line/40">
      {HOURS.slice(0, -1).map((h) => (
        <HourLine key={h} hour={h} />
      ))}
      {apts.map((a) => (
        <JobBlock key={a.id} apt={a} onClick={() => onSelect(a)} />
      ))}
    </div>
  );
}

// ─── Detail bottom sheet ────────────────────────────────────────────────────

function JobDetailSheet({
  apt,
  onClose,
}: {
  apt: Appointment;
  onClose: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const cfg = STATUS_CFG[apt.status] ?? STATUS_CFG.unconfirmed;

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  function close() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  const estimatesHref = apt.contact_id
    ? `/estimates?contact=${apt.contact_id}`
    : "/estimates";
  const invoicesHref = apt.contact_id
    ? `/invoices?contact=${apt.contact_id}`
    : "/invoices";

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={close}
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-[60] flex max-h-[85dvh] flex-col rounded-t-3xl bg-white transition-transform duration-300 ease-out ${visible ? "translate-y-0" : "translate-y-full"}`}
      >
        {/* Handle */}
        <div className="flex flex-shrink-0 items-center justify-between px-5 pt-3 pb-4">
          <div className="mx-auto h-1 w-10 rounded-full bg-line" />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          {/* Status + title */}
          <div className="mb-4 space-y-1.5">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badge}`}>
              {cfg.label}
            </span>
            <h2 className="font-display text-xl font-bold text-text-primary">
              {apt.title}
            </h2>
          </div>

          {/* Details */}
          <dl className="mb-5 space-y-3 text-sm">
            {apt.contact_name && <DetailRow label="Contact" value={apt.contact_name} />}
            {apt.job_type && <DetailRow label="Job type" value={apt.job_type} />}
            <DetailRow label="Start" value={new Date(apt.start_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} />
            <DetailRow label="End" value={new Date(apt.end_time).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} />
            {apt.assigned_to && <DetailRow label="Assigned to" value={apt.assigned_to} />}
            {apt.notes && <DetailRow label="Notes" value={apt.notes} />}
          </dl>

          {/* Action links */}
          <div className="grid grid-cols-2 gap-2">
            <SheetLink href="/clients" label="View Contact" icon="👤" />
            <SheetLink href={estimatesHref} label="View Estimates" icon="📋" />
            <SheetLink href={invoicesHref} label="View Invoices" icon="💰" />
            <SheetLink href="#" label="Job Notes" icon="📝" onClick={close} />
          </div>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="flex-shrink-0 text-text-secondary">{label}</dt>
      <dd className="text-right font-medium text-text-primary">{value}</dd>
    </div>
  );
}

function SheetLink({
  href,
  label,
  icon,
  onClick,
}: {
  href: string;
  label: string;
  icon: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-card border border-line bg-white px-3 py-3 text-sm font-semibold text-text-primary transition active:scale-[0.98]"
    >
      <span className="text-base">{icon}</span>
      {label}
    </Link>
  );
}

// ─── Create appointment sheet ───────────────────────────────────────────────

function CreateSheet({
  defaultDate,
  onClose,
  onCreated,
}: {
  defaultDate: Date;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  function close() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  const pad = (n: number) => String(n).padStart(2, "0");
  const dateStr = `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth() + 1)}-${pad(defaultDate.getDate())}`;
  const defaultStart = `${dateStr}T08:00`;
  const defaultEnd = `${dateStr}T09:00`;

  function handleSubmit(fd: FormData) {
    setError(null);
    start(async () => {
      const res = await createCalendarAppointmentAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
      } else {
        onCreated();
        close();
      }
    });
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/40 transition-opacity duration-200 ${visible ? "opacity-100" : "opacity-0"}`}
        onClick={close}
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-[60] flex max-h-[90dvh] flex-col rounded-t-3xl bg-white transition-transform duration-300 ease-out ${visible ? "translate-y-0" : "translate-y-full"}`}
      >
        {/* Handle */}
        <div className="flex flex-shrink-0 items-center justify-between px-5 pt-3 pb-2">
          <div className="mx-auto h-1 w-10 rounded-full bg-line" />
        </div>
        <div className="flex-shrink-0 flex items-center justify-between border-b border-line px-5 pb-4">
          <h3 className="font-display text-lg font-bold text-text-primary">New appointment</h3>
          <button
            type="button"
            onClick={close}
            className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary hover:bg-black/5"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <form action={handleSubmit} className="space-y-4 pt-4">
            <Input id="title" name="title" label="Job title" placeholder="HVAC tune-up" required />
            <Input id="contact_name" name="contact_name" label="Contact name" placeholder="Jane Smith" />
            <Input id="contact_id" name="contact_id" label="GHL contact ID" placeholder="Optional — enables GHL sync" />
            <Input id="job_type" name="job_type" label="Job type" placeholder="HVAC, Plumbing, Electrical…" />

            <div className="grid grid-cols-2 gap-3">
              <Input
                id="start_time"
                name="start_time"
                type="datetime-local"
                label="Start"
                defaultValue={defaultStart}
                required
              />
              <Input
                id="end_time"
                name="end_time"
                type="datetime-local"
                label="End"
                defaultValue={defaultEnd}
                required
              />
            </div>

            <Input id="assigned_to" name="assigned_to" label="Assigned to" placeholder="Crew member name" />
            <Textarea id="notes" name="notes" label="Notes" placeholder="Optional job notes…" />

            {error && (
              <p className="rounded-card bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
            )}

            <Button type="submit" size="lg" disabled={pending}>
              {pending ? "Saving…" : "Save appointment"}
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}

// ─── Main CalendarView ──────────────────────────────────────────────────────

export function CalendarView({
  initialAppointments,
  today,
}: {
  initialAppointments: Appointment[];
  today: string;
}) {
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date(today)));
  const [appointments, setAppointments] = useState(initialAppointments);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [, startTransition] = useTransition();

  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Open detail sheet if ?job= param is present
  useEffect(() => {
    const jobId = searchParams.get("job");
    if (jobId) {
      const found = appointments.find((a) => a.id === jobId);
      if (found) setSelectedAppt(found);
    }
  }, [searchParams, appointments]);

  // Fetch appointments when date changes
  const fetchRange = useCallback(
    (base: Date) => {
      let from: string;
      let to: string;
      if (viewMode === "day") {
        from = startOfDay(base).toISOString();
        to = addDays(startOfDay(base), 1).toISOString();
      } else {
        const ws = getWeekStart(base);
        from = ws.toISOString();
        to = addDays(ws, 7).toISOString();
      }
      startTransition(async () => {
        const data = await fetchCalendarRangeAction(from, to);
        setAppointments(data);
      });
    },
    [viewMode],
  );

  function navigate(dir: -1 | 1) {
    const next =
      viewMode === "day"
        ? addDays(currentDate, dir)
        : addDays(currentDate, dir * 7);
    setCurrentDate(next);
    fetchRange(next);
  }

  function syncHeaderScroll() {
    if (headerRef.current && bodyRef.current) {
      headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
  }

  const weekStart = getWeekStart(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayDate = startOfDay(new Date(today));

  return (
    <div className="-mx-4 flex flex-col overflow-hidden" style={{ height: "calc(100dvh - 56px - 80px)" }}>
      {/* ── Header ── */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-line bg-white px-4 py-3">
        {/* Date + nav */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary active:bg-black/5"
          >
            ‹
          </button>
          <span className="min-w-0 text-sm font-semibold text-text-primary">
            {viewMode === "day"
              ? fmtDateHeader(currentDate)
              : `${weekStart.toLocaleDateString([], { month: "short", day: "numeric" })} – ${addDays(weekStart, 6).toLocaleDateString([], { month: "short", day: "numeric" })}`}
          </span>
          <button
            type="button"
            onClick={() => navigate(1)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary active:bg-black/5"
          >
            ›
          </button>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-0.5 rounded-full bg-bg p-0.5">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setViewMode(v);
                fetchRange(currentDate);
              }}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                viewMode === v
                  ? "bg-white text-text-primary shadow-sm"
                  : "text-text-secondary"
              }`}
            >
              {v === "day" ? "Day" : "Week"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Week day headers (hidden in day view) ── */}
      {viewMode === "week" && (
        <div
          ref={headerRef}
          className="flex flex-shrink-0 overflow-x-hidden border-b border-line bg-white"
        >
          <div className="w-14 flex-shrink-0" />
          {weekDays.map((day) => {
            const isToday = isSameDay(day, todayDate);
            const isSelected = isSameDay(day, currentDate);
            return (
              <button
                key={day.toISOString()}
                type="button"
                onClick={() => setCurrentDate(startOfDay(day))}
                className="flex flex-1 min-w-[72px] flex-col items-center py-2"
              >
                <span className="text-[10px] text-text-secondary">{fmtDayShort(day)}</span>
                <span
                  className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${
                    isToday
                      ? "bg-mint text-ink"
                      : isSelected
                      ? "bg-bg text-text-primary"
                      : "text-text-primary"
                  }`}
                >
                  {fmtDayNum(day)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Calendar body ── */}
      <div
        ref={bodyRef}
        className="flex-1 overflow-auto"
        onScroll={viewMode === "week" ? syncHeaderScroll : undefined}
      >
        <div className="flex" style={{ height: TOTAL_HEIGHT }}>
          {/* Time column */}
          <div className="relative w-14 flex-shrink-0 sticky left-0 z-10 bg-white border-r border-line/40">
            {HOURS.map((h) => (
              <TimeLabel key={h} hour={h} />
            ))}
          </div>

          {/* Day columns */}
          {viewMode === "day" ? (
            <DayColumn
              day={currentDate}
              apts={getApptsForDay(appointments, currentDate)}
              onSelect={setSelectedAppt}
            />
          ) : (
            weekDays.map((day) => (
              <DayColumn
                key={day.toISOString()}
                day={day}
                apts={getApptsForDay(appointments, day)}
                onSelect={setSelectedAppt}
              />
            ))
          )}
        </div>
      </div>

      {/* ── FAB ── */}
      <button
        type="button"
        aria-label="New appointment"
        onClick={() => setCreateOpen(true)}
        className="fixed bottom-[96px] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-mint text-ink shadow-lg shadow-mint/40 transition active:scale-95"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>

      {/* ── Sheets ── */}
      {selectedAppt && (
        <JobDetailSheet apt={selectedAppt} onClose={() => setSelectedAppt(null)} />
      )}
      {createOpen && (
        <CreateSheet
          defaultDate={currentDate}
          onClose={() => setCreateOpen(false)}
          onCreated={() => fetchRange(currentDate)}
        />
      )}
    </div>
  );
}
