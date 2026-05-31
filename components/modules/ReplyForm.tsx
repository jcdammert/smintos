"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessageAction } from "@/lib/actions";

export function ReplyForm({ clientId }: { clientId: string }) {
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    start(async () => {
      const res = await sendMessageAction(clientId, body, "SMS");
      if (!res.ok) {
        setError(res.error ?? "Send failed.");
      } else {
        setBody("");
        router.refresh();
      }
    });
  }

  return (
    <form
      onSubmit={submit}
      className="fixed inset-x-0 bottom-[72px] z-30 mx-auto w-full max-w-md border-t border-line bg-white p-3 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex items-end gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={1}
          placeholder="Type a reply…"
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-card border border-line bg-white px-3 py-2 text-base outline-none focus:border-mint focus:ring-2 focus:ring-mint/30"
        />
        <button
          type="submit"
          disabled={pending || !body.trim()}
          className="min-h-[44px] flex-shrink-0 rounded-card bg-mint px-4 text-sm font-semibold text-ink transition active:scale-95 disabled:opacity-50"
        >
          {pending ? "…" : "Send"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
    </form>
  );
}
