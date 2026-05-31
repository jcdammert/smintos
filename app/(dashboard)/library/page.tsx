import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import {
  getClients,
  getEstimates,
  getInvoices,
  getProducts,
} from "@/lib/data";
import { ClientRow } from "@/components/modules/ClientRow";
import { ImportContactsButton } from "@/components/modules/ImportContactsButton";
import { ImportEstimatesButton } from "@/components/modules/ImportEstimatesButton";
import { ImportInvoicesButton } from "@/components/modules/ImportInvoicesButton";
import { ImportProductsButton } from "@/components/modules/ImportProductsButton";
import { EstimateBadge, InvoiceBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/format";
import type {
  Client,
  Product,
  WithClient,
  Estimate,
  Invoice,
} from "@/types";

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

  const tab: Tab =
    searchParams.tab === "estimates"
      ? "estimates"
      : searchParams.tab === "invoices"
        ? "invoices"
        : searchParams.tab === "products"
          ? "products"
          : "clients";

  const [clients, estimates, invoices, products] = await Promise.all([
    getClients(user.id),
    getEstimates(user.id),
    getInvoices(user.id),
    getProducts(user.id),
  ]);

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Library
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          Everything in one place.
        </p>
      </header>

      <nav className="flex gap-1 rounded-card border border-line bg-white p-1">
        <TabLink href="/library?tab=clients" label="Clients" count={clients.length} active={tab === "clients"} />
        <TabLink href="/library?tab=estimates" label="Estimates" count={estimates.length} active={tab === "estimates"} />
        <TabLink href="/library?tab=invoices" label="Invoices" count={invoices.length} active={tab === "invoices"} />
        <TabLink href="/library?tab=products" label="Products" count={products.length} active={tab === "products"} />
      </nav>

      {tab === "clients" && <ClientsTab clients={clients} />}
      {tab === "estimates" && <EstimatesTab estimates={estimates} />}
      {tab === "invoices" && <InvoicesTab invoices={invoices} />}
      {tab === "products" && <ProductsTab products={products} />}
    </div>
  );
}

function TabLink({
  href,
  label,
  count,
  active,
}: {
  href: string;
  label: string;
  count: number;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-lg text-xs font-semibold transition ${
        active ? "bg-mint text-ink" : "text-text-secondary"
      }`}
    >
      <span className="text-[13px]">{label}</span>
      <span className={`text-[10px] ${active ? "text-ink/70" : "text-text-secondary/70"}`}>
        {count}
      </span>
    </Link>
  );
}

function ClientsTab({ clients }: { clients: Client[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{clients.length} total</span>
        <LinkButton href="/clients/new" size="sm">+ Add</LinkButton>
      </div>
      <ImportContactsButton />
      {clients.length === 0 ? (
        <EmptyState title="No clients yet" subtitle="Add one manually, or pull from GoHighLevel." />
      ) : (
        <div className="space-y-2">
          {clients.map((c) => (
            <ClientRow key={c.id} client={c} />
          ))}
        </div>
      )}
    </div>
  );
}

function EstimatesTab({ estimates }: { estimates: WithClient<Estimate>[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{estimates.length} total</span>
        <LinkButton href="/estimates/new" size="sm">+ New</LinkButton>
      </div>
      <ImportEstimatesButton />
      {estimates.length === 0 ? (
        <EmptyState title="No estimates yet" subtitle="Create your first estimate and send it to a client." />
      ) : (
        <div className="space-y-2">
          {estimates.map((e) => (
            <Link
              key={e.id}
              href={`/estimates/${e.id}`}
              className="flex items-center gap-3 rounded-card border border-line bg-white p-3 transition active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-text-primary">
                  {e.name || e.estimate_number} · {formatCurrency(e.total)}
                </p>
                <p className="truncate text-sm text-text-secondary">
                  {e.client?.name ?? "—"} · {formatDate(e.created_at)}
                  {e.viewed_at && <span className="ml-2 text-mint-dark">· 👁 Viewed</span>}
                </p>
              </div>
              <EstimateBadge status={e.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function InvoicesTab({ invoices }: { invoices: WithClient<Invoice>[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{invoices.length} total</span>
        <LinkButton href="/invoices/new" size="sm">+ New</LinkButton>
      </div>
      <ImportInvoicesButton />
      {invoices.length === 0 ? (
        <EmptyState title="No invoices yet" subtitle="Create one directly or convert from an approved estimate." />
      ) : (
        <div className="space-y-2">
          {invoices.map((i) => (
            <Link
              key={i.id}
              href={`/invoices/${i.id}`}
              className="flex items-center gap-3 rounded-card border border-line bg-white p-3 transition active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-text-primary">
                  {i.name || i.invoice_number} · {formatCurrency(i.total)}
                </p>
                <p className="truncate text-sm text-text-secondary">
                  {i.client?.name ?? "—"} · due {formatDate(i.due_date)}
                  {i.viewed_at && <span className="ml-2 text-mint-dark">· 👁 Viewed</span>}
                </p>
              </div>
              <InvoiceBadge status={i.status} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function ProductsTab({ products }: { products: Product[] }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">{products.length} total</span>
      </div>
      <ImportProductsButton />
      {products.length === 0 ? (
        <EmptyState
          title="No products yet"
          subtitle="Add products in GoHighLevel and tap import — they'll be selectable when building estimates and invoices."
        />
      ) : (
        <div className="space-y-2">
          {products.map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-card border border-line bg-white p-3"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-text-primary">{p.name}</p>
                {p.description && (
                  <p className="truncate text-xs text-text-secondary">{p.description}</p>
                )}
              </div>
              <span className="flex-shrink-0 font-bold text-mint-dark">
                {formatCurrency(p.unit_price)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
