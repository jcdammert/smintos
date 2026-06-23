"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { formatCurrency } from "@/lib/format";
import type { Product, LineItem } from "@/types";

export function ProductPicker({
  products,
  onPick,
}: {
  products: Product[];
  onPick: (item: LineItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const filtered = query.trim()
    ? products.filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()),
      )
    : products;

  function pick(p: Product) {
    onPick({
      id: `prod-${p.id}-${Date.now()}`,
      description: p.name, // just the name — description is GHL marketing copy
      quantity: 1,
      unitPrice: p.unit_price,
    });
    setJustAdded(p.id);
    // Brief "Added ✓" flash, then close.
    setTimeout(() => {
      setOpen(false);
      setJustAdded(null);
      setQuery("");
    }, 600);
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

      <Modal open={open} onClose={() => { setOpen(false); setQuery(""); }} title="Choose a product">
        {products.length === 0 ? (
          <p className="rounded-card border border-dashed border-line bg-white p-4 text-center text-sm text-text-secondary">
            No products yet. Import from Library → Products.
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
                <p className="px-1 py-3 text-center text-sm text-text-secondary">No match.</p>
              ) : (
                filtered.map((p) => {
                  const added = justAdded === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => pick(p)}
                      disabled={added}
                      className={`flex w-full items-center justify-between gap-3 rounded-card border p-3 text-left transition active:scale-[0.99] ${
                        added
                          ? "border-mint bg-mint/10"
                          : "border-line bg-white"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className={`truncate font-semibold ${added ? "text-mint-dark" : "text-text-primary"}`}>
                          {added ? "✓ Added" : p.name}
                        </p>
                        {p.description && !added && (
                          <p className="truncate text-xs text-text-secondary">
                            {p.description}
                          </p>
                        )}
                      </div>
                      <span className={`flex-shrink-0 text-sm font-bold ${added ? "text-mint-dark" : "text-mint-dark"}`}>
                        {formatCurrency(p.unit_price)}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
