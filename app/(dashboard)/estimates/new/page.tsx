import Link from "next/link";
import { getCurrentUser, hasGhlCreds } from "@/lib/session";
import { getClients, getProducts } from "@/lib/data";
import { listEstimates, getEstimate } from "@/lib/ghl";
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
  // Use saved default terms; if none saved yet, fetch full detail of most recent GHL estimate
  // (the list API only returns summary objects — terms live in the detail endpoint)
  let defaultTerms = user.default_terms ?? "";
  if (!defaultTerms && hasGhlCreds(user)) {
    const listRes = await listEstimates(user.ghl_location_id, user.ghl_api_key, { limit: 10 });
    if (listRes.ok && listRes.data?.estimates?.length) {
      for (const est of listRes.data.estimates) {
        const id = (est._id ?? est.id) as string | undefined;
        if (!id) continue;
        const detail = await getEstimate(user.ghl_location_id, user.ghl_api_key, id);
        if (!detail.ok) continue;
        // GHL wraps it under `estimate` or returns it flat
        const obj = (detail.data?.estimate ?? detail.data) as Record<string, unknown> | null;
        const t = typeof obj?.terms === "string" ? obj.terms.trim() : "";
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
