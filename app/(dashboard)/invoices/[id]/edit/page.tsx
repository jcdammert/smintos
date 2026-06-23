import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { getInvoice, getClients, getProducts } from "@/lib/data";
import { InvoiceForm } from "@/components/modules/InvoiceForm";

export const dynamic = "force-dynamic";

export default async function EditInvoicePage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getCurrentUser();
  if (!user) return null;

  const [invoice, clients, products] = await Promise.all([
    getInvoice(user.id, params.id),
    getClients(user.id),
    getProducts(user.id),
  ]);
  if (!invoice) notFound();

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Link
          href={`/invoices/${invoice.id}`}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white"
          aria-label="Back"
        >
          ←
        </Link>
        <h1 className="font-display text-2xl font-bold text-text-primary">
          Edit invoice
        </h1>
      </header>

      <InvoiceForm
        clients={clients}
        products={products}
        editingInvoice={invoice}
      />
    </div>
  );
}
