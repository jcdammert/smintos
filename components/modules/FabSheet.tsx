"use client";

import { useState } from "react";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";

const actions: Array<{
  href: string;
  label: string;
  icon: JSX.Element;
}> = [
  {
    href: "/estimates/new",
    label: "Estimate",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M6 2h8l4 4v16H6V2z" strokeLinejoin="round" />
        <path d="M9 12h6M9 16h6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/invoices/new",
    label: "Invoice",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/clients/new",
    label: "Client",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/calendar?new=1",
    label: "Appointment",
    icon: (
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.8">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 9h18M8 3v4M16 3v4" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function FabSheet() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label="Create new"
        onClick={() => setOpen(true)}
        className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-mint text-ink shadow-lg shadow-mint/40 transition active:scale-95"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Create new…">
        <div className="grid grid-cols-2 gap-3">
          {actions.map((a) => (
            <Link
              key={a.href}
              href={a.href}
              onClick={() => setOpen(false)}
              className="flex flex-col items-center justify-center gap-2 rounded-card border border-line bg-white p-5 text-center transition active:scale-95"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-mint/15 text-mint-dark">
                {a.icon}
              </span>
              <span className="text-sm font-semibold text-text-primary">
                {a.label}
              </span>
            </Link>
          ))}
        </div>
      </Modal>
    </>
  );
}
