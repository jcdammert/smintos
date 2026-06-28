"use client";

import {
  useState,
  useEffect,
  useRef,
  useTransition,
  useCallback,
} from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  createCalendarAppointmentAction,
  fetchCalendarRangeAction,
  fetchContactWorkAction,
  fetchProductsForPickerAction,
} from "@/lib/actions";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/lib/format";
import type { Appointment, AppointmentStatus } from "@/types";

const CalendarMapView = dynamic(
  () => import("@/components/modules/CalendarMapView").then((m) => ({ default: m.CalendarMapView })),
  { ssr: false },
);

// ─── Constants ─────────────────────────────────────────────────────────────

const START_HOUR = 0;
const END_HOUR = 23;
const HOUR_HEIGHT = 64;
const TOTAL_HEIGHT = (END_HOUR - START_HOUR) * HOUR_HEIGHT;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);

const STATUS_CFG: Record<
  AppointmentStatus,
  { bg: string; border: string; text: string; badge: string; label: string }
> = {
  confirmed:   { bg: "bg-mint/10",   border: "border-l-mint-dark", text: "text-mint-dark",  badge: "bg-mint/20 text-mint-dark",    label: "Confirmed"   },
  showed:      { bg: "bg-blue-50",   border: "border-l-blue-500",  text: "text-blue-700",   badge: "bg-blue-100 text-blue-700",    label: "Showed"      },
  cancelled:   { bg: "bg-red-50",    border: "border-l-red-500",   text: "text-red-700",    badge: "bg-red-100 text-red-700",      label: "Cancelled"   },
  no_show:     { bg: "bg-orange-50", border: "border-l-orange-500",text: "text-orange-700", badge: "bg-orange-100 text-orange-700",label: "No Show"     },
  unconfirmed: { bg: "bg-gray-50",   border: "border-l-gray-400",  text: "text-gray-600",   badge: "bg-gray-100 text-gray-600",    label: "Unconfirmed" },
  invalid:     { bg: "bg-gray-50",   border: "border-l-gray-400",  text: "text-gray-600",   badge: "bg-gray-100 text-gray-600",    label: "Invalid"     },
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function startOfDay(d: Date) { const c = new Date(d); c.setHours(0,0,0,0); return c; }
function addDays(d: Date, n: number) { const c = new Date(d); c.setDate(c.getDate()+n); return c; }
function getWeekStart(d: Date) { const c = new Date(d); c.setDate(c.getDate()-c.getDay()); c.setHours(0,0,0,0); return c; }
function isSameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}
function getApptsForDay(apts: Appointment[], day: Date) {
  return apts.filter((a) => isSameDay(new Date(a.start_time), day));
}
function posStyle(apt: Appointment) {
  const s = new Date(apt.start_time), e = new Date(apt.end_time);
  const top    = Math.max(0, (s.getHours()*60+s.getMinutes() - START_HOUR*60) * (HOUR_HEIGHT/60));
  const height = Math.max(24, (e.getHours()*60+e.getMinutes() - s.getHours()*60-s.getMinutes()) * (HOUR_HEIGHT/60));
  return { top, height };
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour:"numeric", minute:"2-digit" });
}
function fmtDateHeader(d: Date) {
  return d.toLocaleDateString([], { weekday:"long", month:"long", day:"numeric" });
}

// ─── Grid sub-components ───────────────────────────────────────────────────

function TimeLabel({ hour }: { hour: number }) {
  if (hour === END_HOUR) return null;
  return (
    <div className="absolute left-0 right-0 flex items-start pl-1" style={{ top: (hour-START_HOUR)*HOUR_HEIGHT }}>
      <span className="text-[10px] leading-none text-text-secondary">
        {hour===0?"12am":hour<12?`${hour}am`:hour===12?"12pm":`${hour-12}pm`}
      </span>
    </div>
  );
}
function HourLine({ hour }: { hour: number }) {
  return <div className="pointer-events-none absolute left-0 right-0 border-t border-line/50" style={{ top:(hour-START_HOUR)*HOUR_HEIGHT }} />;
}
function JobBlock({ apt, onClick }: { apt: Appointment; onClick: () => void }) {
  const { top, height } = posStyle(apt);
  const cfg = STATUS_CFG[apt.status] ?? STATUS_CFG.unconfirmed;
  return (
    <button type="button" onClick={onClick}
      className={`absolute left-0 right-0.5 rounded-r-lg border-l-[3px] px-1.5 py-0.5 text-left ${cfg.bg} ${cfg.border} transition active:opacity-70`}
      style={{ top, height, minHeight:24 }}
    >
      <p className={`truncate text-xs font-semibold leading-tight ${cfg.text}`}>{apt.contact_name||apt.title}</p>
      {height>=40 && <p className={`truncate text-[10px] leading-tight ${cfg.text} opacity-70`}>{apt.job_type?`${apt.job_type} · `:""}{fmtTime(apt.start_time)}</p>}
    </button>
  );
}
function DayColumn({ day, apts, onSelect }: { day: Date; apts: Appointment[]; onSelect: (a: Appointment) => void }) {
  return (
    <div className="relative flex-1 min-w-[72px] border-r border-line/40">
      {HOURS.slice(0,-1).map((h) => <HourLine key={h} hour={h} />)}
      {apts.map((a) => <JobBlock key={a.id} apt={a} onClick={()=>onSelect(a)} />)}
    </div>
  );
}

// ─── Job-title picker ───────────────────────────────────────────────────────

type WorkItem =
  | { kind: "estimate"; id: string; label: string; sub: string }
  | { kind: "invoice";  id: string; label: string; sub: string }
  | { kind: "product";  id: string; label: string; sub: string };

function JobTitlePicker({
  contactId,
  contactName,
  value,
  onChange,
}: {
  contactId?: string;
  contactName?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [work, products] = await Promise.all([
        fetchContactWorkAction({ contactId, contactName }),
        fetchProductsForPickerAction(),
      ]);
      setItems([
        ...work.estimates.map((e) => ({
          kind: "estimate" as const,
          id: e.id,
          label: e.name || `Estimate #${e.estimate_number}`,
          sub: `${formatCurrency(e.total)} · ${e.status}`,
        })),
        ...work.invoices.map((i) => ({
          kind: "invoice" as const,
          id: i.id,
          label: i.name || `Invoice #${i.invoice_number}`,
          sub: `${formatCurrency(i.total)} · ${i.status}`,
        })),
        ...products.map((p) => ({
          kind: "product" as const,
          id: p.id,
          label: p.name,
          sub: formatCurrency(p.unit_price),
        })),
      ]);
      setLoading(false);
    })();
  }, [contactId, contactName]); // eslint-disable-line react-hooks/exhaustive-deps

  const q = value.toLowerCase();
  const filtered = q ? items.filter((i) => i.label.toLowerCase().includes(q)) : items;
  const estimates = filtered.filter((i) => i.kind === "estimate");
  const invoices  = filtered.filter((i) => i.kind === "invoice");
  const products  = filtered.filter((i) => i.kind === "product");

  function pick(item: WorkItem) { onChange(item.label); setOpen(false); }

  return (
    <div className="relative">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-text-primary">Job title <span className="font-normal text-text-secondary">(optional)</span></span>
        <input
          name="title"
          value={value}
          autoComplete="off"
          onChange={(e) => { onChange(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Pick from estimates, invoices, or products…"
          className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30 placeholder:text-text-secondary"
        />
      </label>

      {open && (
        <>
          <div className="fixed inset-0 z-[70]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 top-full z-[80] mt-1 max-h-56 overflow-y-auto rounded-card border border-line bg-white shadow-xl">
            {loading ? (
              <p className="px-4 py-3 text-sm text-text-secondary">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-text-secondary">No matches — type a custom title and save.</p>
            ) : (
              <>
                {estimates.length > 0 && <PickerGroup title="Estimates" items={estimates} onPick={pick} />}
                {invoices.length  > 0 && <PickerGroup title="Invoices"  items={invoices}  onPick={pick} />}
                {products.length  > 0 && <PickerGroup title="Products"  items={products}  onPick={pick} />}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PickerGroup({ title, items, onPick }: { title: string; items: WorkItem[]; onPick: (i: WorkItem) => void }) {
  return (
    <div>
      <p className="sticky top-0 bg-bg px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-secondary">{title}</p>
      {items.map((item) => (
        <button key={item.id} type="button" onClick={() => onPick(item)}
          className="flex w-full items-center justify-between px-4 py-2.5 text-left transition active:bg-bg"
        >
          <span className="truncate text-sm font-medium text-text-primary">{item.label}</span>
          <span className="ml-2 flex-shrink-0 text-xs text-text-secondary">{item.sub}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Address autocomplete input ─────────────────────────────────────────────

let mapsOptionsSet = false;

function AddressAutocompleteInput({ defaultValue }: { defaultValue?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [val, setVal] = useState(defaultValue ?? "");
  const initDone = useRef(false);

  function initAutocomplete() {
    if (initDone.current || !inputRef.current) return;
    initDone.current = true;

    if (!mapsOptionsSet) {
      setOptions({ key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "", v: "weekly" });
      mapsOptionsSet = true;
    }

    importLibrary("places").then(() => {
      if (!inputRef.current) return;
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        types: ["address"],
        fields: ["formatted_address"],
      });
      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        const addr = place.formatted_address ?? "";
        setVal(addr);
        if (inputRef.current) inputRef.current.value = addr;
      });
    });
  }

  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text-primary">Job address</span>
      <input
        ref={inputRef}
        name="address"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onFocus={initAutocomplete}
        placeholder="1445 Main St, Miami, FL"
        autoComplete="off"
        className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30 placeholder:text-text-secondary"
      />
      <span className="mt-1 block text-xs text-text-secondary">Used to pin this job on the map view</span>
    </label>
  );
}

// ─── Job detail bottom sheet ────────────────────────────────────────────────

// Shared sheet wrapper — constrained to mobile width, centered on desktop
const SHEET_CLS = "fixed bottom-0 left-1/2 z-[60] w-full max-w-md -translate-x-1/2 flex flex-col rounded-t-3xl bg-white transition-transform duration-300 ease-out";
const BACKDROP_CLS = "fixed inset-0 z-50 bg-black/40 transition-opacity duration-200";

function JobDetailSheet({ apt, onClose }: { apt: Appointment; onClose: () => void }) {
  const [visible, setVisible] = useState(false);
  const cfg = STATUS_CFG[apt.status] ?? STATUS_CFG.unconfirmed;

  useEffect(() => { const t = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(t); }, []);
  function close() { setVisible(false); setTimeout(onClose, 280); }

  const estimatesHref = apt.contact_id ? `/estimates?contact=${apt.contact_id}` : "/estimates";
  const invoicesHref  = apt.contact_id ? `/invoices?contact=${apt.contact_id}`  : "/invoices";
  const mapsHref      = apt.address ? `https://maps.google.com/?q=${encodeURIComponent(apt.address)}` : null;

  return (
    <>
      <div className={`${BACKDROP_CLS} ${visible?"opacity-100":"opacity-0"}`} onClick={close} />
      <div className={`${SHEET_CLS} max-h-[85dvh] ${visible?"translate-y-0":"translate-y-full"}`}>
        <div className="flex flex-shrink-0 justify-center px-5 pt-3 pb-4">
          <div className="h-1 w-10 rounded-full bg-line" />
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="mb-4 space-y-1.5">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badge}`}>{cfg.label}</span>
            <h2 className="font-display text-xl font-bold text-text-primary">{apt.title}</h2>
          </div>
          <dl className="mb-5 space-y-3 text-sm">
            {apt.contact_name && <DetailRow label="Contact"     value={apt.contact_name} />}
            {apt.job_type     && <DetailRow label="Job type"    value={apt.job_type} />}
            {apt.address      && <DetailRow label="Address"     value={apt.address} />}
            <DetailRow label="Start"  value={new Date(apt.start_time).toLocaleString([],{dateStyle:"medium",timeStyle:"short"})} />
            <DetailRow label="End"    value={new Date(apt.end_time).toLocaleString([],{dateStyle:"medium",timeStyle:"short"})} />
            {apt.assigned_to && <DetailRow label="Assigned to" value={apt.assigned_to} />}
            {apt.notes        && <DetailRow label="Notes"       value={apt.notes} />}
          </dl>
          <div className="grid grid-cols-2 gap-2">
            <SheetLink href="/clients"      label="View Contact"   icon="👤" />
            <SheetLink href={estimatesHref} label="View Estimates" icon="📋" />
            <SheetLink href={invoicesHref}  label="View Invoices"  icon="💰" />
            {mapsHref
              ? <SheetLink href={mapsHref} label="Get Directions" icon="🗺️" external />
              : <SheetLink href="#" label="Job Notes" icon="📝" onClick={close} />}
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
function SheetLink({ href, label, icon, onClick, external }: { href: string; label: string; icon: string; onClick?: () => void; external?: boolean }) {
  return (
    <Link href={href} onClick={onClick} target={external?"_blank":undefined} rel={external?"noopener noreferrer":undefined}
      className="flex items-center gap-2.5 rounded-card border border-line bg-white px-3 py-3 text-sm font-semibold text-text-primary transition active:scale-[0.98]"
    >
      <span className="text-base">{icon}</span>{label}
    </Link>
  );
}

// ─── Create appointment sheet ───────────────────────────────────────────────

function CreateSheet({
  defaultDate,
  defaultContactName,
  defaultContactId,
  onClose,
  onCreated,
}: {
  defaultDate: Date;
  defaultContactName?: string;
  defaultContactId?: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [visible, setVisible] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [contactName, setContactName] = useState(defaultContactName ?? "");

  useEffect(() => { const t = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(t); }, []);
  function close() { setVisible(false); setTimeout(onClose, 280); }

  const pad = (n: number) => String(n).padStart(2,"0");
  const dateStr = `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth()+1)}-${pad(defaultDate.getDate())}`;

  function handleSubmit(fd: FormData) {
    setError(null);
    start(async () => {
      const res = await createCalendarAppointmentAction(fd);
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else { onCreated(); close(); }
    });
  }

  return (
    <>
      <div className={`${BACKDROP_CLS} ${visible?"opacity-100":"opacity-0"}`} onClick={close} />
      <div className={`${SHEET_CLS} max-h-[90dvh] ${visible?"translate-y-0":"translate-y-full"}`}>
        <div className="flex flex-shrink-0 justify-center px-5 pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-line" />
        </div>
        <div className="flex flex-shrink-0 items-center justify-between border-b border-line px-5 pb-4">
          <h3 className="font-display text-lg font-bold text-text-primary">New appointment</h3>
          <button type="button" onClick={close} className="flex h-10 w-10 items-center justify-center rounded-full text-text-secondary hover:bg-black/5">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <form action={handleSubmit} className="space-y-4 pt-4">
            {/* Contact name — controlled so we can pass it to the title picker */}
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-text-primary">Contact name</span>
              <input
                name="contact_name"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="Jane Smith"
                className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30 placeholder:text-text-secondary"
              />
            </label>

            {/* Hidden GHL contact ID */}
            <input type="hidden" name="contact_id" value={defaultContactId ?? ""} />

            <Input id="job_type" name="job_type" label="Job type" placeholder="Auto tint, Residential…" />

            {/* Job title — optional, picks from estimates / invoices / products */}
            <JobTitlePicker
              contactId={defaultContactId}
              contactName={contactName || defaultContactName}
              value={title}
              onChange={setTitle}
            />

            <AddressAutocompleteInput />

            <div className="grid grid-cols-2 gap-3">
              <Input id="start_time" name="start_time" type="datetime-local" label="Start" defaultValue={`${dateStr}T08:00`} required />
              <Input id="end_time"   name="end_time"   type="datetime-local" label="End"   defaultValue={`${dateStr}T09:00`} required />
            </div>

            <Input id="assigned_to" name="assigned_to" label="Assigned to" placeholder="Crew member name" />
            <Textarea id="notes" name="notes" label="Notes" placeholder="Optional job notes…" />

            {error && <p className="rounded-card bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}

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

type ViewMode = "day" | "week" | "map";

export function CalendarView({
  initialAppointments,
  today,
}: {
  initialAppointments: Appointment[];
  today: string;
}) {
  const searchParams = useSearchParams();
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState(() => startOfDay(new Date(today)));
  const [appointments, setAppointments] = useState(initialAppointments);
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [, startFetch] = useTransition();

  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef   = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const jobId = searchParams.get("job");
    if (jobId) {
      const found = appointments.find((a) => a.id === jobId);
      if (found) setSelectedAppt(found);
    }
  }, [searchParams, appointments]);

  useEffect(() => {
    if (searchParams.get("new") === "1") setCreateOpen(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchRange = useCallback(
    (base: Date, mode: ViewMode = viewMode) => {
      let from: string, to: string;
      if (mode === "week") {
        const ws = getWeekStart(base);
        from = ws.toISOString();
        to   = addDays(ws, 7).toISOString();
      } else {
        from = startOfDay(base).toISOString();
        to   = addDays(startOfDay(base), 1).toISOString();
      }
      startFetch(async () => {
        const data = await fetchCalendarRangeAction(from, to);
        setAppointments(data);
      });
    },
    [viewMode],
  );

  function navigate(dir: -1 | 1) {
    const next = viewMode === "week" ? addDays(currentDate, dir*7) : addDays(currentDate, dir);
    setCurrentDate(next);
    fetchRange(next);
  }
  function switchView(v: ViewMode) { setViewMode(v); fetchRange(currentDate, v); }
  function syncHeaderScroll() {
    if (headerRef.current && bodyRef.current) headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
  }

  const weekStart = getWeekStart(currentDate);
  const weekDays  = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const todayDate = startOfDay(new Date(today));
  const dayApts   = getApptsForDay(appointments, currentDate);

  return (
    <div className="-mx-4 flex flex-col overflow-hidden" style={{ height:"calc(100dvh - 56px - 80px)" }}>
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-line bg-white px-4 py-3">
        <div className="flex items-center gap-1">
          <button type="button" onClick={()=>navigate(-1)} className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary active:bg-black/5">‹</button>
          <span className="text-sm font-semibold text-text-primary">
            {viewMode==="week"
              ? `${weekStart.toLocaleDateString([],{month:"short",day:"numeric"})} – ${addDays(weekStart,6).toLocaleDateString([],{month:"short",day:"numeric"})}`
              : fmtDateHeader(currentDate)}
          </span>
          <button type="button" onClick={()=>navigate(1)} className="flex h-9 w-9 items-center justify-center rounded-full text-text-secondary active:bg-black/5">›</button>
        </div>
        <div className="flex items-center gap-0.5 rounded-full bg-bg p-0.5">
          {(["day","week","map"] as const).map((v) => (
            <button key={v} type="button" onClick={()=>switchView(v)}
              className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${viewMode===v?"bg-white text-text-primary shadow-sm":"text-text-secondary"}`}
            >
              {v==="day"?"Day":v==="week"?"Week":"Map"}
            </button>
          ))}
        </div>
      </div>

      {/* Week day headers */}
      {viewMode==="week" && (
        <div ref={headerRef} className="flex flex-shrink-0 overflow-x-hidden border-b border-line bg-white">
          <div className="w-14 flex-shrink-0" />
          {weekDays.map((day) => {
            const isToday    = isSameDay(day, todayDate);
            const isSelected = isSameDay(day, currentDate);
            return (
              <button key={day.toISOString()} type="button" onClick={()=>setCurrentDate(startOfDay(day))} className="flex flex-1 min-w-[72px] flex-col items-center py-2">
                <span className="text-[10px] text-text-secondary">{day.toLocaleDateString([],{weekday:"short"})}</span>
                <span className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isToday?"bg-mint text-ink":isSelected?"bg-bg text-text-primary":"text-text-primary"}`}>
                  {day.getDate()}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Body */}
      {viewMode==="map" ? (
        <CalendarMapView appointments={dayApts} onSelectAppt={setSelectedAppt} />
      ) : (
        <div ref={bodyRef} className="flex-1 overflow-auto" onScroll={viewMode==="week"?syncHeaderScroll:undefined}>
          <div className="flex" style={{ height:TOTAL_HEIGHT }}>
            <div className="relative w-14 flex-shrink-0 sticky left-0 z-10 bg-white border-r border-line/40">
              {HOURS.map((h) => <TimeLabel key={h} hour={h} />)}
            </div>
            {viewMode==="day" ? (
              <DayColumn day={currentDate} apts={dayApts} onSelect={setSelectedAppt} />
            ) : (
              weekDays.map((day) => (
                <DayColumn key={day.toISOString()} day={day} apts={getApptsForDay(appointments,day)} onSelect={setSelectedAppt} />
              ))
            )}
          </div>
        </div>
      )}

      {/* FAB */}
      <button type="button" aria-label="New appointment" onClick={()=>setCreateOpen(true)}
        className="fixed bottom-[96px] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-mint text-ink shadow-lg shadow-mint/40 transition active:scale-95"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>

      {selectedAppt && <JobDetailSheet apt={selectedAppt} onClose={()=>setSelectedAppt(null)} />}
      {createOpen && (
        <CreateSheet
          defaultDate={currentDate}
          defaultContactName={searchParams.get("contact_name") ?? undefined}
          defaultContactId={searchParams.get("contact_id") ?? undefined}
          onClose={()=>setCreateOpen(false)}
          onCreated={()=>fetchRange(currentDate)}
        />
      )}
    </div>
  );
}
