import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getClient, getMessagesForClient } from "@/lib/data";
import { ReplyForm } from "@/components/modules/ReplyForm";
import { ScrollToBottom } from "@/components/modules/ScrollToBottom";
import { formatTime, formatDate } from "@/lib/format";
import { getUserTimezone } from "@/lib/timezone";
import type { Message } from "@/types";

export const dynamic = "force-dynamic";

function isCallMessage(m: Message) {
  const ch = (m.channel ?? "").toLowerCase();
  return ch.includes("call") || ch.includes("voicemail") || m.call_duration !== null || m.call_status !== null;
}

function fmtDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function CallCard({ m, tz }: { m: Message; tz: string }) {
  const isOutbound = m.direction === "outbound";
  const status = m.call_status ?? "";
  const isMissed = ["missed", "no_answer", "cancelled", "busy"].includes(status);
  const isVoicemail = status === "voicemail" || (m.channel ?? "").toLowerCase().includes("voicemail");

  let statusLabel = "Call";
  if (isVoicemail) statusLabel = "Voicemail";
  else if (isMissed) statusLabel = "Missed call";
  else if (status === "answered" || status === "completed") statusLabel = "Call";
  else if (status) statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div className="mx-auto w-[88%] rounded-xl border border-line bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-base ${isMissed ? "bg-red-100" : isVoicemail ? "bg-purple-100" : "bg-mint/10"}`}>
          {isMissed ? "📵" : isVoicemail ? "🎙️" : "📞"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm text-text-primary">
            {isOutbound ? "Outbound" : "Inbound"} · {statusLabel}
          </p>
          <p className="text-xs text-text-secondary">
            {formatTime(m.created_at, tz)}
            {m.call_duration ? ` · ${fmtDuration(m.call_duration)}` : ""}
          </p>
        </div>
        <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${isMissed ? "bg-red-100 text-red-700" : isVoicemail ? "bg-purple-100 text-purple-700" : "bg-mint/15 text-mint-dark"}`}>
          {isMissed ? "Missed" : isVoicemail ? "Voicemail" : m.call_duration ? fmtDuration(m.call_duration) : "Answered"}
        </span>
      </div>
      {m.recording_url && (
        <div className="border-t border-line px-4 py-3">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={m.recording_url} className="h-10 w-full" />
        </div>
      )}
      {m.transcript && (
        <details className="border-t border-line">
          <summary className="cursor-pointer px-4 py-2.5 text-xs font-semibold text-mint-dark list-none flex items-center gap-1.5">
            <span>📄</span> View transcript
          </summary>
          <p className="px-4 pb-3 text-xs text-text-secondary whitespace-pre-wrap leading-relaxed">{m.transcript}</p>
        </details>
      )}
    </div>
  );
}

export default async function ThreadPage({
  params,
}: {
  params: { clientId: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const client = await getClient(user.id, params.clientId);
  if (!client) notFound();

  const [messages, tz] = await Promise.all([
    getMessagesForClient(user.id, client.id),
    getUserTimezone(),
  ]);

  return (
    <>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-line bg-bg px-4 pb-3 pt-3">
        <div className="flex items-center gap-3">
          <Link
            href="/messages"
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-line bg-white"
            aria-label="Back"
          >
            ←
          </Link>
          <Link href={`/clients/${client.id}`} className="min-w-0 flex-1 active:opacity-70">
            <h1 className="truncate font-display text-xl font-bold text-text-primary">
              {client.name}
            </h1>
            <p className="truncate text-xs text-mint-dark">
              {client.phone ?? client.email ?? "Tap to view profile →"}
            </p>
          </Link>
          {client.phone && (
            <a
              href={`tel:${client.phone}`}
              className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-mint text-ink shadow-sm active:scale-95"
              aria-label={`Call ${client.name}`}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.01 2.18 2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92z" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-3 pb-36 pt-3">
        {messages.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-white p-6 text-center text-sm text-text-secondary">
            No messages with this client yet. Send the first one below.
          </p>
        ) : (
          <>
            {messages.map((m, i) => {
              const isOutbound = m.direction === "outbound";
              const prev = messages[i - 1];
              const showDay =
                !prev ||
                new Date(prev.created_at).toDateString() !==
                  new Date(m.created_at).toDateString();
              const isCall = isCallMessage(m);
              return (
                <div key={m.id}>
                  {showDay && (
                    <p className="my-3 text-center text-[11px] font-medium text-text-secondary">
                      {formatDate(m.created_at, tz)}
                    </p>
                  )}
                  {isCall ? (
                    <CallCard m={m} tz={tz} />
                  ) : (
                    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-sm ${isOutbound ? "rounded-br-sm bg-mint text-ink" : "rounded-bl-sm border border-line bg-white text-text-primary"}`}>
                        <p className="whitespace-pre-wrap break-words">{m.body ?? ""}</p>
                        <p className={`mt-1 text-[10px] ${isOutbound ? "text-ink/70" : "text-text-secondary"}`}>
                          {formatTime(m.created_at, tz)}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <ScrollToBottom />
          </>
        )}
      </div>

      <ReplyForm clientId={client.id} />
    </>
  );
}
