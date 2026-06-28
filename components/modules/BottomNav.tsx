"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

const FabSheet = dynamic(
  () => import("@/components/modules/FabSheet").then((m) => ({ default: m.FabSheet })),
  {
    ssr: false,
    loading: () => (
      <div className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-mint shadow-lg shadow-mint/40">
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M12 5v14M5 12h14" strokeLinecap="round" />
        </svg>
      </div>
    ),
  },
);

const tabs = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/library", label: "Library", icon: LibraryIcon },
  { href: "/messages", label: "Messages", icon: ChatIcon },
  { href: "/settings", label: "Account", icon: UserIcon },
];

export function BottomNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="relative mx-auto grid max-w-md grid-cols-5 items-center px-2">
        {/* left two tabs */}
        {tabs.slice(0, 2).map((t) => (
          <NavTab key={t.href} {...t} active={isActive(t.href)} />
        ))}

        {/* center FAB → opens create sheet */}
        <div className="flex justify-center">
          <FabSheet />
        </div>

        {/* right two tabs */}
        {tabs.slice(2).map((t) => (
          <NavTab key={t.href} {...t} active={isActive(t.href)} />
        ))}
      </div>
    </nav>
  );
}

function NavTab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: (p: { active: boolean }) => JSX.Element;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[44px] flex-col items-center justify-center gap-0.5 py-2 text-[11px] font-medium transition ${
        active ? "text-ink" : "text-text-secondary"
      }`}
    >
      <Icon active={active} />
      {label}
    </Link>
  );
}

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path d="M3 11l9-7 9 7v8a2 2 0 01-2 2h-4v-6H9v6H5a2 2 0 01-2-2v-8z" strokeLinejoin="round" />
    </svg>
  );
}
function LibraryIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path d="M4 4h5v16H4zM10 4h5v16h-5zM18 4l3 1-3 15-3-1z" strokeLinejoin="round" />
    </svg>
  );
}
function ChatIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <path d="M4 5h16v11H8l-4 4V5z" strokeLinejoin="round" />
    </svg>
  );
}
function CalendarIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 9h18M8 3v4M16 3v4" stroke={active ? "#fff" : "currentColor"} strokeLinecap="round" />
    </svg>
  );
}
function UserIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" strokeLinecap="round" />
    </svg>
  );
}
