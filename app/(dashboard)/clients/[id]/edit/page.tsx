import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getClient } from "@/lib/data";
import { ClientEditForm } from "@/components/modules/ClientEditForm";

export const dynamic = "force-dynamic";

export default async function EditClientPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const client = await getClient(user.id, params.id);
  if (!client) notFound();

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href={`/clients/${client.id}`}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Edit client
        </h1>
      </header>

      <ClientEditForm client={client} />
    </div>
  );
}
