"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/format";
import type { Product, LineItem } from "@/types";

/**
 * Browse-and-add modal. Renders inside EstimateForm / InvoiceForm and calls
 * onPick with a ready-to-use LineItem when the user taps a product.
 */
export function ProductPicker({
  products,
  onPick,
}: {
  products: Product[];
  onPick: (item: LineItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = query.trim()
    ? products.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()),
      )
    : products;

  function pick(p: Product) {
    onPick({
      id: `prod-${p.id}-${Date.now()}`,
      description: p.name + (p.description ? ` — ${p.description}` : ""),
      quantity: 1,
      unitPrice: p.unit_price,
    });
    setOpen(false);
    setQuery("");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="min-h-[44px] w-full rounded-card border border-mint bg-mint/5 text-sm font-semibold text-mint-dark transition active:scale-[0.99]"
      >
        + Add from products
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Choose a product">
        {products.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-white p-4 text-center text-sm text-text-secondary">
            No products yet. Import them from GoHighLevel under Library →
            Products, or add them in GHL.
          </p>
        ) : (
          <div className="space-y-3">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products…"
              className="min-h-[44px] w-full rounded-card border border-line bg-white px-3 text-base outline-none focus:border-mint focus:ring-2 focus:ring-mint/30"
            />
            <div className="max-h-[60vh] space-y-2 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-1 py-3 text-center text-sm text-text-secondary">
                  No match.
                </p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => pick(p)}
                    className="flex w-full items-center justify-between gap-3 rounded-card border border-line bg-white p-3 text-left transition active:scale-[0.99]"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-text-primary">
                        {p.name}
                      </p>
                      {p.description && (
                        <p className="truncate text-xs text-text-secondary">
                          {p.description}
                        </p>
                      )}
                    </div>
                    <span className="flex-shrink-0 text-sm font-bold text-mint-dark">
                      {formatCurrency(p.unit_price)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
