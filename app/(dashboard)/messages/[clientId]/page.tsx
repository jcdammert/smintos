import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getClient, getMessagesForClient } from "@/lib/data";
import { ReplyForm } from "@/components/modules/ReplyForm";
import { formatTime, formatDate } from "@/lib/format";
import { getUserTimezone } from "@/lib/timezone";

export const dynamic = "force-dynamic";

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
    <div className="space-y-4 pb-32">
      <header className="flex items-center gap-3">
        <Link
          href="/messages"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
          aria-label="Back"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-bold text-text-primary">
            {client.name}
          </h1>
          <p className="truncate text-xs text-text-secondary">
            {client.phone ?? client.email ?? "—"}
          </p>
        </div>
      </header>

      {messages.length === 0 ? (
        <p className="rounded-card border border-dashed border-line bg-white p-6 text-center text-sm text-text-secondary">
          No messages with this client yet. Send the first one below.
        </p>
      ) : (
        <div className="space-y-3">
          {messages.map((m, i) => {
            const isOutbound = m.direction === "outbound";
            const prev = messages[i - 1];
            const showDay =
              !prev ||
              new Date(prev.created_at).toDateString() !==
                new Date(m.created_at).toDateString();
            return (
              <div key={m.id}>
                {showDay && (
                  <p className="my-3 text-center text-[11px] font-medium text-text-secondary">
                    {formatDate(m.created_at, tz)}
                  </p>
                )}
                <div
                  className={`flex ${
                    isOutbound ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                      isOutbound
                        ? "rounded-br-sm bg-mint text-ink"
                        : "rounded-bl-sm border border-line bg-white text-text-primary"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {m.body ?? ""}
                    </p>
                    <p
                      className={`mt-1 text-[10px] ${
                        isOutbound ? "text-ink/70" : "text-text-secondary"
                      }`}
                    >
                      {formatTime(m.created_at, tz)}
                      {m.channel ? ` · ${m.channel}` : ""}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ReplyForm clientId={client.id} />
    </div>
  );
}
