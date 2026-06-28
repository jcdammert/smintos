import { getCurrentUser } from "@/lib/session";
import { getClients, getEstimates, getInvoices, getProducts } from "@/lib/data";
import { getUserTimezone } from "@/lib/timezone";
import { LibraryTabs } from "@/components/modules/LibraryTabs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Tab = "clients" | "estimates" | "invoices" | "products";

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const initialTab: Tab =
    searchParams.tab === "estimates" ? "estimates"
    : searchParams.tab === "invoices"  ? "invoices"
    : searchParams.tab === "products"  ? "products"
    : "clients";

  const [clients, estimates, invoices, products, tz] = await Promise.all([
    getClients(user.id),
    getEstimates(user.id),
    getInvoices(user.id),
    getProducts(user.id),
    getUserTimezone(),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-text-primary">Library</h1>
        <p className="mt-1 text-sm text-text-secondary">Everything in one place.</p>
      </header>

      <LibraryTabs
        initialTab={initialTab}
        clients={clients}
        estimates={estimates}
        invoices={invoices}
        products={products}
        tz={tz}
      />
    </div>
  );
}
