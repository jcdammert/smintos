import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getMessageThreads } from "@/lib/data";
import { EmptyState } from "@/components/ui/Card";
import { formatTime, formatDate } from "@/lib/format";
import { getUserTimezone } from "@/lib/timezone";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export default async function MessagesPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const [threads, tz] = await Promise.all([
    getMessageThreads(user.id),
    getUserTimezone(),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Messages
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          SMS threads with your clients.
        </p>
      </header>

      {threads.length === 0 ? (
        <EmptyState
          title="No messages yet"
          subtitle="Tap import above to pull your existing GoHighLevel conversations, or wait for new ones to arrive via the webhook."
        />
      ) : (
        <div className="space-y-2">
          {threads.map((t) => {
            const last = t.last;
            const ts = new Date(last.created_at);
            const isFromToday = new Date().toDateString() === ts.toDateString();
            const initials =
              (t.client?.name ?? "??")
                .split(" ")
                .slice(0, 2)
                .map((p) => p[0]?.toUpperCase() ?? "")
                .join("") || "?";
            return (
              <Link
                key={t.client?.id ?? t.ghl_contact_id ?? t.last.id}
                href={t.client ? `/messages/${t.client.id}` : "#"}
                className={`flex items-start gap-3 rounded-card border border-line bg-white p-3 transition active:scale-[0.99] ${
                  !t.client ? "opacity-60" : ""
                }`}
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-mint/15 text-sm font-bold text-[#067a44]">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-text-primary">
                      {t.client?.name ?? "Unknown contact"}
                    </p>
                    <span className="flex-shrink-0 text-[11px] text-text-secondary">
                      {isFromToday
                        ? formatTime(last.created_at, tz)
                        : formatDate(last.created_at, tz)}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-text-secondary">
                    {last.direction === "outbound" && (
                      <span className="text-text-secondary">You: </span>
                    )}
                    {last.body || "(no body)"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
