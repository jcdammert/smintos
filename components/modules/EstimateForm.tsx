"use client";

import { useState, useTransition, useEffect } from "react";
import { createEstimateAction, updateEstimateAction, fetchGhlDefaultTermsAction } from "@/lib/actions";
import { Button } from "@/components/ui/Button";
import dynamic from "next/dynamic";
const ProductPicker = dynamic(
  () => import("@/components/modules/ProductPicker").then((m) => ({ default: m.ProductPicker })),
  { ssr: false, loading: () => <div className="h-10 animate-pulse rounded-card bg-line" /> },
);
import { formatCurrency } from "@/lib/format";
import type { Client, Discount, Estimate, LineItem, Product } from "@/types";

let idCounter = 0;
function newItem(): LineItem {
  idCounter += 1;
  return { id: `tmp-${Date.now()}-${idCounter}`, description: "", quantity: 1, unitPrice: 0 };
}

function defaultExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function EstimateForm({
  clients,
  products,
  defaultClientId,
  defaultTerms = "",
  editingEstimate,
}: {
  clients: Client[];
  products: Product[];
  defaultClientId?: string;
  defaultTerms?: string;
  editingEstimate?: Estimate;
}) {
  const [clientId, setClientId]   = useState(editingEstimate?.client_id ?? defaultClientId ?? "");
  const [name, setName]           = useState(editingEstimate?.name ?? "");
  const [items, setItems]         = useState<LineItem[]>(
    editingEstimate?.line_items?.length ? (editingEstimate.line_items as LineItem[]) : [newItem()],
  );
  const [discount, setDiscount]   = useState<Discount>({ type: "fixed", value: 0 });
  const [expiryDate, setExpiryDate] = useState(defaultExpiry());
  const [taxEnabled, setTaxEnabled] = useState(false);
  const [taxRate, setTaxRate]       = useState<number | "">(0);
  const [includeTerms, setIncludeTerms] = useState(true);
  const [terms, setTerms]         = useState(editingEstimate?.terms ?? defaultTerms);
  const [termsLoading, setTermsLoading] = useState(false);
  const [termsError, setTermsError]     = useState<string | null>(null);
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositAmount, setDepositAmount]   = useState(0);
  const [depositType, setDepositType]       = useState<"fixed" | "percent">("fixed");
  const [pending, start] = useTransition();

  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discountAmount = discount.value > 0
    ? discount.type === "percent" ? subtotal * (discount.value / 100) : discount.value
    : 0;
  const taxRateNum = typeof taxRate === "number" ? taxRate : 0;
  const taxAmount = taxEnabled && taxRateNum > 0 ? subtotal * (taxRateNum / 100) : 0;
  const total = Math.max(0, subtotal - discountAmount + taxAmount);

  const depositDollar = depositEnabled && depositAmount > 0
    ? depositType === "percent" ? total * (depositAmount / 100) : depositAmount
    : 0;

  function update(id: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));
  }
  function remove(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }
  function addProductAsItem(item: LineItem) {
    setItems((prev) => {
      if (prev.length === 1 && !prev[0].description && prev[0].unitPrice === 0) return [item];
      return [...prev, item];
    });
  }

  function loadTermsFromGhl() {
    setTermsError(null);
    setTermsLoading(true);
    fetchGhlDefaultTermsAction().then((res) => {
      setTermsLoading(false);
      if (res.ok && res.terms) {
        setTerms(res.terms);
        setIncludeTerms(true);
      } else {
        setTermsError(res.error ?? "No terms found in GHL");
      }
    });
  }

  // Auto-load terms on mount if none pre-filled
  useEffect(() => {
    if (!terms) loadTermsFromGhl();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit() {
    if (!clientId) return;
    const fd = new FormData();
    fd.set("client_id", clientId);
    fd.set("name", name);
    fd.set("line_items", JSON.stringify(items.filter((i) => i.description)));
    fd.set("discount", JSON.stringify(discount));
    fd.set("expiry_date", expiryDate);
    fd.set("tax_rate", taxEnabled ? String(taxRateNum) : "0");
    fd.set("terms", includeTerms ? terms : "");
    fd.set("deposit_amount", depositEnabled ? String(depositAmount) : "0");
    fd.set("deposit_type", depositType);
    if (editingEstimate) {
      start(() => updateEstimateAction(editingEstimate.id, fd));
    } else {
      start(() => createEstimateAction(fd));
    }
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
      {/* Name */}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-text-primary">Estimate name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Full-vehicle ceramic tint"
          className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base outline-none focus:border-mint focus:ring-2 focus:ring-mint/30"
        />
      </label>

      {/* Client */}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-text-primary">Client</span>
        <select
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base outline-none focus:border-mint focus:ring-2 focus:ring-mint/30"
        >
          <option value="">Select a client…</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>

      {/* Expiry date */}
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-text-primary">Expiry date</span>
        <input
          type="date"
          value={expiryDate}
          onChange={(e) => setExpiryDate(e.target.value)}
          className="min-h-[48px] w-full rounded-card border border-line bg-white px-4 text-base outline-none focus:border-mint focus:ring-2 focus:ring-mint/30"
        />
      </label>

      {/* Line items */}
      <div className="space-y-3">
        <span className="block text-sm font-medium text-text-primary">Line items</span>
        <ProductPicker products={products} onPick={addProductAsItem} />
        {items.map((item) => (
          <div key={item.id} className="space-y-2 rounded-card border border-line bg-white p-3">
            <input
              value={item.description}
              onChange={(e) => update(item.id, { description: e.target.value })}
              placeholder="Item name (e.g. Full Vehicle Ceramic Tint)"
              className="min-h-[44px] w-full rounded-lg border border-line px-3 text-base outline-none focus:border-mint"
            />
            {item.notes !== undefined ? (
              <textarea
                value={item.notes}
                onChange={(e) => update(item.id, { notes: e.target.value })}
                placeholder="Description (optional)"
                rows={2}
                className="min-h-[44px] w-full resize-y rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-mint"
              />
            ) : (
              <button type="button" onClick={() => update(item.id, { notes: "" })} className="text-xs text-mint-dark">
                + Add description
              </button>
            )}
            <div className="flex items-center gap-2">
              <label className="flex-1">
                <span className="mb-1 block text-xs text-text-secondary">Qty</span>
                <input
                  type="number" min={1} inputMode="numeric" value={item.quantity}
                  onChange={(e) => update(item.id, { quantity: Number(e.target.value) || 0 })}
                  className="min-h-[44px] w-full rounded-lg border border-line px-3 text-base outline-none focus:border-mint"
                />
              </label>
              <label className="flex-1">
                <span className="mb-1 block text-xs text-text-secondary">Unit price</span>
                <input
                  type="number" min={0} step="0.01" inputMode="decimal" value={item.unitPrice}
                  onChange={(e) => update(item.id, { unitPrice: Number(e.target.value) || 0 })}
                  className="min-h-[44px] w-full rounded-lg border border-line px-3 text-base outline-none focus:border-mint"
                />
              </label>
              <button
                type="button" onClick={() => remove(item.id)} aria-label="Remove line item"
                className="mt-5 flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg text-text-secondary hover:bg-black/5"
              >✕</button>
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

      {/* Totals block with inline discount + tax toggles */}
      <div className="rounded-card border border-line bg-white divide-y divide-line">
        {/* Subtotal row */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-secondary">Subtotal</span>
          <span className="text-sm font-medium text-text-primary">{formatCurrency(subtotal)}</span>
        </div>

        {/* Discount toggle */}
        {discountAmount > 0 ? (
          <div className="flex items-center gap-2 px-4 py-2">
            <select
              value={discount.type}
              onChange={(e) => setDiscount({ ...discount, type: e.target.value as "fixed" | "percent" })}
              className="h-8 rounded-lg border border-line bg-white px-2 text-xs outline-none focus:border-mint"
            >
              <option value="fixed">$</option>
              <option value="percent">%</option>
            </select>
            <input
              type="number" min={0} step={discount.type === "percent" ? 1 : 0.01}
              max={discount.type === "percent" ? 100 : undefined}
              value={discount.value || ""}
              onChange={(e) => setDiscount({ ...discount, value: Number(e.target.value) || 0 })}
              autoFocus
              className="h-8 w-24 rounded-lg border border-line px-2 text-sm outline-none focus:border-mint"
            />
            <span className="flex-1 text-right text-sm text-danger">
              − {formatCurrency(discountAmount)}
            </span>
            <button type="button" onClick={() => setDiscount({ type: "fixed", value: 0 })}
              className="text-text-secondary hover:text-text-primary text-xs">✕</button>
          </div>
        ) : (
          <button type="button" onClick={() => setDiscount({ type: "fixed", value: 0.01 })}
            className="flex w-full items-center gap-1.5 px-4 py-2 text-xs font-semibold text-mint-dark text-left">
            + Add discount
          </button>
        )}

        {/* Tax toggle */}
        {taxEnabled ? (
          <div className="flex items-center gap-2 px-4 py-2">
            <input
              type="number" min={0} max={100} step="0.1" inputMode="decimal"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="0"
              className="h-8 w-20 rounded-lg border border-line px-2 text-sm outline-none focus:border-mint"
            />
            <span className="text-xs text-text-secondary">% tax</span>
            <span className="flex-1 text-right text-sm text-text-secondary">
              {taxAmount > 0 ? `+ ${formatCurrency(taxAmount)}` : ""}
            </span>
            <button type="button" onClick={() => { setTaxEnabled(false); setTaxRate(0); }}
              className="text-text-secondary hover:text-text-primary text-xs">✕</button>
          </div>
        ) : (
          <button type="button" onClick={() => setTaxEnabled(true)}
            className="flex w-full items-center gap-1.5 px-4 py-2 text-xs font-semibold text-mint-dark text-left">
            + Add tax
          </button>
        )}

        {/* Total row */}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-text-secondary">Total</span>
          <span className="font-display text-xl font-bold text-mint-dark">{formatCurrency(total)}</span>
        </div>
      </div>

      {/* Deposit */}
      <div className="rounded-card border border-line bg-white p-3 space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={depositEnabled}
            onChange={(e) => setDepositEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-line accent-mint"
          />
          <span className="text-sm font-medium text-text-primary">Require deposit</span>
        </label>
        {depositEnabled && (
          <div className="space-y-2">
            <div className="flex gap-2">
              <select
                value={depositType}
                onChange={(e) => setDepositType(e.target.value as "fixed" | "percent")}
                className="min-h-[44px] rounded-lg border border-line bg-white px-3 text-sm outline-none focus:border-mint"
              >
                <option value="fixed">$ Fixed</option>
                <option value="percent">% of total</option>
              </select>
              <input
                type="number" min={0} step={depositType === "percent" ? 1 : 0.01}
                max={depositType === "percent" ? 100 : undefined}
                value={depositAmount || ""}
                onChange={(e) => setDepositAmount(Number(e.target.value) || 0)}
                placeholder={depositType === "percent" ? "e.g. 50" : "e.g. 100.00"}
                className="min-h-[44px] flex-1 rounded-lg border border-line bg-white px-3 text-base outline-none focus:border-mint"
              />
            </div>
            {depositDollar > 0 && (
              <p className="text-right text-sm font-semibold text-mint-dark">
                Deposit due: {formatCurrency(depositDollar)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Terms & conditions */}
      <div className="rounded-card border border-line bg-white p-3 space-y-2">
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={includeTerms}
              onChange={(e) => setIncludeTerms(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-mint"
            />
            <span className="text-sm font-medium text-text-primary">Include terms &amp; conditions</span>
          </label>
          <button
            type="button"
            onClick={loadTermsFromGhl}
            disabled={termsLoading}
            className="text-xs font-semibold text-mint-dark disabled:opacity-50"
          >
            {termsLoading ? "Loading…" : "↓ Load from GHL"}
          </button>
        </div>
        {termsError && (
          <p className="text-xs text-danger">{termsError}</p>
        )}
        {includeTerms && (
          <textarea
            value={terms}
            onChange={(e) => setTerms(e.target.value)}
            rows={6}
            placeholder={termsLoading ? "Loading your terms from GHL…" : "Add your terms and conditions…"}
            className="w-full resize-y rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-mint"
          />
        )}
      </div>

      <Button type="button" size="lg" disabled={pending || !clientId} onClick={submit}>
        {pending
          ? editingEstimate ? "Saving…" : "Creating…"
          : editingEstimate ? "Save changes" : "Create estimate"}
      </Button>
    </div>
  );
}
