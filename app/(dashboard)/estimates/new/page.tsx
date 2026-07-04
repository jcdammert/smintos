import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { getClients, getProducts } from "@/lib/data";
import { EstimateForm } from "@/components/modules/EstimateForm";

export const dynamic = "force-dynamic";

export default async function NewEstimatePage({
  searchParams,
}: {
  searchParams: { client?: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;
  const [clients, products] = await Promise.all([
    getClients(user.id),
    getProducts(user.id),
  ]);
  const defaultTerms = user.default_terms ?? "";

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href="/estimates"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="font-display text-2xl font-bold text-text-primary">
          New estimate
        </h1>
      </header>

      <EstimateForm
        clients={clients}
        products={products}
        defaultClientId={searchParams.client}
        defaultTerms={defaultTerms}
      />
    </div>
  );
}
