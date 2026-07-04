"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncAllGhlAction } from "@/lib/actions";

export function SyncIconButton() {
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const router = useRouter();

  function run() {
    if (pending) return;
    setStatus("idle");
    start(async () => {
      const res = await syncAllGhlAction();
      setStatus(res.ok ? "ok" : "error");
      if (res.ok) router.refresh();
      // Reset status indicator after 3s
      setTimeout(() => setStatus("idle"), 3000);
    });
  }

  return (
    <button
      onClick={run}
      disabled={pending}
      aria-label="Sync from GoHighLevel"
      className={`relative flex h-11 w-11 items-center justify-center rounded-full border border-line bg-white transition active:scale-95 disabled:opacity-60 ${
        status === "ok" ? "border-mint" : status === "error" ? "border-danger" : ""
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        className={`h-5 w-5 transition-colors ${
          pending ? "animate-spin text-mint-dark" :
          status === "ok" ? "text-mint-dark" :
          status === "error" ? "text-danger" :
          "text-text-primary"
        }`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
      {status === "ok" && (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-mint" />
      )}
      {status === "error" && (
        <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger" />
      )}
    </button>
  );
}
