import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getEstimate, getClients, getProducts } from "@/lib/data";
import { EstimateForm } from "@/components/modules/EstimateForm";

export const dynamic = "force-dynamic";

export default async function EditEstimatePage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const [estimate, clients, products] = await Promise.all([
    getEstimate(user.id, params.id),
    getClients(user.id),
    getProducts(user.id),
  ]);
  if (!estimate) notFound();

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href={`/estimates/${estimate.id}`}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Edit estimate
        </h1>
      </header>

      <EstimateForm
        clients={clients}
        products={products}
        editingEstimate={estimate}
      />
    </div>
  );
}
