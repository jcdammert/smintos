"use client";

import { useState, useTransition } from "react";
import { fetchCallTranscriptAction } from "@/lib/actions";

export function CallTranscriptLoader({
  messageId,
  initialTranscript,
}: {
  messageId: string;
  initialTranscript: string | null;
}) {
  const [transcript, setTranscript] = useState(initialTranscript);
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (transcript) { setOpen((o) => !o); return; }
    setError(null);
    start(async () => {
      const res = await fetchCallTranscriptAction(messageId);
      if (!res.ok) { setError(res.error ?? "Couldn't load transcript."); return; }
      setTranscript(res.transcript ?? null);
      setOpen(true);
    });
  }

  if (!transcript && error) {
    return (
      <div className="border-t border-line px-4 py-2.5">
        <p className="text-xs text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="border-t border-line">
      <button
        type="button"
        onClick={load}
        disabled={pending}
        className="flex w-full items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-mint-dark transition active:opacity-70 disabled:opacity-50"
      >
        <span>📄</span>
        {pending ? "Loading transcript…" : transcript ? (open ? "Hide transcript" : "View transcript") : "Load transcript"}
      </button>
      {open && transcript && (
        <p className="px-4 pb-3 text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">
          {transcript}
        </p>
      )}
    </div>
  );
}
