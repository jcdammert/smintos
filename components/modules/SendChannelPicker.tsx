"use client";

import { useState, useTransition } from "react";

type Channel = "email" | "sms" | "sms_and_email";

const options: { value: Channel; label: string; icon: string }[] = [
  { value: "email", label: "Email only", icon: "✉️" },
  { value: "sms", label: "SMS only", icon: "💬" },
  { value: "sms_and_email", label: "Both", icon: "📲" },
];

export function SendChannelPicker({
  onSend,
  label = "Send to client",
}: {
  onSend: (channel: Channel) => Promise<void> | void;
  label?: string;
}) {
  const [channel, setChannel] = useState<Channel>("sms_and_email");
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => setChannel(o.value)}
            className={`flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-card border text-xs font-semibold transition ${
              channel === o.value
                ? "border-mint bg-mint/10 text-mint-dark"
                : "border-line bg-white text-text-secondary"
            }`}
          >
            <span>{o.icon}</span>
            <span>{o.label}</span>
          </button>
        ))}
      </div>
      <button
        disabled={pending}
        onClick={() => start(async () => { await onSend(channel); })}
        className="min-h-[52px] w-full rounded-card bg-ink text-base font-semibold text-white transition active:scale-[0.98] disabled:opacity-50"
      >
        {pending ? "Sending…" : `${label} via ${options.find(o => o.value === channel)?.icon}`}
      </button>
    </div>
  );
}
