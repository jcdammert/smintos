import Link from "next/link";
import type { Client } from "@/types";

export function ClientRow({ client }: { client: Client }) {
  const initials = client.name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <Link
      href={`/clients/${client.id}`}
      className="flex items-center gap-3 rounded-card border border-line bg-white p-3 transition active:scale-[0.99]"
    >
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-mint/15 text-sm font-bold text-[#067a44]">
        {initials || "?"}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-text-primary">{client.name}</p>
        <p className="truncate text-sm text-text-secondary">
          {client.phone || client.email || "No contact info"}
        </p>
      </div>
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-text-secondary" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </Link>
  );
}
