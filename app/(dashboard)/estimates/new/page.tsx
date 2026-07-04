import Link from "next/link";
import { getCurrentUser, hasGhlCreds } from "@/lib/session";
import { getClients, getProducts } from "@/lib/data";
import { listEstimates } from "@/lib/ghl";
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
  // Use saved default terms; if none saved yet, try pulling from most recent GHL estimate
  let defaultTerms = user.default_terms ?? "";
  if (!defaultTerms && hasGhlCreds(user)) {
    const ghlRes = await listEstimates(user.ghl_location_id, user.ghl_api_key, { limit: 5 });
    if (ghlRes.ok && ghlRes.data?.estimates?.length) {
      for (const est of ghlRes.data.estimates) {
        const t = typeof est.terms === "string" ? est.terms.trim() : "";
        if (t) { defaultTerms = t; break; }
      }
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href="/library?tab=estimates"
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
