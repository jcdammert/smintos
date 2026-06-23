"use client";

import { useState, useTransition } from "react";
import { createEstimateAction } from "@/lib/actions";
import { Button } from "@/components/ui/Button";
import { ProductPicker } from "@/components/modules/ProductPicker";
import { formatCurrency } from "@/lib/format";
import type { Client, Discount, LineItem, Product } from "@/types";

let idCounter = 0;
function newItem(): LineItem {
  idCounter += 1;
  return {
    id: `tmp-${Date.now()}-${idCounter}`,
    description: "",
    quantity: 1,
    unitPrice: 0,
  };
}

export function EstimateForm({
  clients,
  products,
  defaultClientId,
}: {
  clients: Client[];
  products: Product[];
  defaultClientId?: string;
}) {
  const [clientId, setClientId] = useState(defaultClientId ?? "");
  const [name, setName] = useState("");
  const [items, setItems] = useState<LineItem[]>([newItem()]);
  const [discount, setDiscount] = useState<Discount>({ type: "fixed", value: 0 });
  const [pending, start] = useTransition();

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discountAmount = discount.value > 0
    ? discount.type === "percent"
      ? subtotal * (discount.value / 100)
      : discount.value
    : 0;
  const total = Math.max(0, subtotal - discountAmount);

  function update(id: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function remove(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }
  function addProductAsItem(item: LineItem) {
    setItems((prev) => {
      // If the first row is empty, replace it; otherwise append.
      if (prev.length === 1 && !prev[0].description && prev[0].unitPrice === 0) {
        return [item];
      }
      return [...prev, item];
    });
  }

  function submit() {
    if (!clientId) return;
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("name", name);
    fd.set("line_items", JSON.stringify(items.filter((i) => i.description)));
    fd.set("discount", JSON.stringify(discount));
    start(() => createEstimateAction(fd));
  }

  if (clients.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line bg-white p-6 text-center text-sm text-text-secondary">
        Add a client first, then come back to build an estimate.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-text-primary">
          Estimate name
        </span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Full-vehicle ceramic tint"
          className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base outline-none focus:border-mint focus:ring-2 focus:ring-mint/30"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-text-primary">
          Client
        </span>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base outline-none focus:border-mint focus:ring-2 focus:ring-mint/30"
        >
          <option value="">Select a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="space-y-3">
        <span className="block text-sm font-medium text-text-primary">
          Line items
        </span>

        <ProductPicker products={products} onPick={addProductAsItem} />

        {items.map((item) => (
          <div
            key={item.id}
            className="space-y-2 rounded-card border border-line bg-white p-3"
          >
            <textarea
              value={item.description}
              onChange={(e) => update(item.id, { description: e.target.value })}
              placeholder="Description (e.g. Driveway pressure wash)"
              rows={2}
              className="min-h-[44px] w-full resize-y rounded-lg border border-line px-3 py-2 text-base outline-none focus:border-mint"
            />
            <div className="flex items-center gap-2">
              <label className="flex-1">
                <span className="mb-1 block text-xs text-text-secondary">Qty</span>
                <input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={item.quantity}
                  onChange={(e) =>
                    update(item.id, { quantity: Number(e.target.value) || 0 })
                  }
                  className="min-h-[44px] w-full rounded-lg border border-line px-3 text-base outline-none focus:border-mint"
                />
              </label>
              <label className="flex-1">
                <span className="mb-1 block text-xs text-text-secondary">
                  Unit price
                </span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  value={item.unitPrice}
                  onChange={(e) =>
                    update(item.id, { unitPrice: Number(e.target.value) || 0 })
                  }
                  className="min-h-[44px] w-full rounded-lg border border-line px-3 text-base outline-none focus:border-mint"
                />
              </label>
              <button
                type="button"
                onClick={() => remove(item.id)}
                aria-label="Remove line item"
                className="mt-5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-black/5"
              >
                ✕
              </button>
            </div>
            <p className="text-right text-sm font-medium text-text-secondary">
              {formatCurrency(item.quantity * item.unitPrice)}
            </p>
          </div>
        ))}

        <button
          type="button"
          onClick={() => setItems((prev) => [...prev, newItem()])}
          className="min-h-[44px] w-full rounded-card border border-dashed border-line text-sm font-semibold text-mint-dark"
        >
          + Add blank line
        </button>
      </div>

      {/* Discount */}
      <div className="rounded-card border border-line bg-white p-3 space-y-2">
        <p className="text-sm font-medium text-text-primary">Discount (optional)</p>
        <div className="flex gap-2">
          <select
            value={discount.type}
            onChange={(e) => setDiscount({ ...discount, type: e.target.value as "fixed" | "percent" })}
            className="min-h-[44px] rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-mint"
          >
            <option value="fixed">$ Fixed</option>
            <option value="percent">% Percent</option>
          </select>
          <input
            type="number"
            min={0}
            step={discount.type === "percent" ? 1 : 0.01}
            max={discount.type === "percent" ? 100 : undefined}
            value={discount.value || ""}
            onChange={(e) => setDiscount({ ...discount, value: Number(e.target.value) || 0 })}
            placeholder={discount.type === "percent" ? "e.g. 10" : "e.g. 50.00"}
            className="min-h-[44px] flex-1 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-mint"
          />
        </div>
        {discountAmount > 0 && (
          <p className="text-right text-sm text-danger">
            − {formatCurrency(discountAmount)}
            {discount.type === "percent" ? ` (${discount.value}%)` : ""}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-card border border-line bg-white p-4">
        <div>
          <span className="text-sm text-text-secondary">Estimate total</span>
          {discountAmount > 0 && (
            <p className="text-xs text-text-secondary line-through">{formatCurrency(subtotal)}</p>
          )}
        </div>
        <span className="font-display text-xl font-bold text-mint-dark">
          {formatCurrency(total)}
        </span>
      </div>

      <Button
        type="button"
        size="lg"
        disabled={pending || !clientId}
        onClick={submit}
      >
        {pending ? "Creating…" : "Create estimate"}
      </Button>
    </div>
  );
}
