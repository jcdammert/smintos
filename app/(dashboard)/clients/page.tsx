import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getClients } from "@/lib/data";
import { ClientRow } from "@/components/modules/ClientRow";
import { ImportContactsButton } from "@/components/modules/ImportContactsButton";
import { EmptyState } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";

export const dynamic = "force-dynamic";
// Allow extra time for the GHL import to paginate through contacts.
export const maxDuration = 60;

export default async function ClientsPage() {
  const user = await getCurrentUser();
  if (!user) return null;
  const clients = await getClients(user.id);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Clients
        </h1>
        <LinkButton href="/clients/new" size="sm">
          + Add
        </LinkButton>
      </header>

      <ImportContactsButton />

      {clients.length > 0 ? (
        <div className="space-y-2">
          {clients.map((c) => (
            <ClientRow key={c.id} client={c} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="No clients yet"
          subtitle="Add your first client to start building estimates."
          action={
            <Link
              href="/clients/new"
              className="rounded-card bg-mint px-5 py-3 text-sm font-semibold text-ink"
            >
              Add client
            </Link>
          }
        />
      )}
    </div>
  );
}
