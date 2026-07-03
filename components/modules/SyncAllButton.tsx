"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { syncAllGhlAction } from "@/lib/actions";

export function SyncAllButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  function run() {
    setMsg(null);
    start(async () => {
      const res = await syncAllGhlAction();
      if (!res.ok) {
        setMsg(`Error: ${res.error}`);
      } else {
        setMsg(`Synced — ${res.summary}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        onClick={run}
        disabled={pending}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-card border border-line bg-white px-4 text-sm font-semibold text-text-primary transition active:scale-[0.99] disabled:opacity-50"
      >
        {pending ? (
          <>
            <svg className="h-4 w-4 animate-spin text-mint-dark" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
            </svg>
            Syncing from GoHighLevel…
          </>
        ) : (
          <>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Sync All from GoHighLevel
          </>
        )}
      </button>
      {msg && (
        <p className={`text-center text-sm ${msg.startsWith("Error") ? "text-danger" : "text-[#067a44]"}`}>
          {msg}
        </p>
      )}
    </div>
  );
}
