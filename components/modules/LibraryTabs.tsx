"use client";

import { useState } from "react";
import Link from "next/link";
import { ClientRow } from "@/components/modules/ClientRow";
import { ImportContactsButton } from "@/components/modules/ImportContactsButton";
import { ImportEstimatesButton } from "@/components/modules/ImportEstimatesButton";
import { ImportInvoicesButton } from "@/components/modules/ImportInvoicesButton";
import { ImportProductsButton } from "@/components/modules/ImportProductsButton";
import { EstimateBadge, InvoiceBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Client, Product, WithClient, Estimate, Invoice } from "@/types";

type Tab = "clients" | "estimates" | "invoices" | "products";

interface Props {
  initialTab: Tab;
  clients: Client[];
  estimates: WithClient<Estimate>[];
  invoices: WithClient<Invoice>[];
  products: Product[];
  tz: string;
}

function SearchBar({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="M21 21l-4.35-4.35" strokeLinecap="round" />
      </svg>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-card border border-line bg-white py-2.5 pl-9 pr-9 text-sm text-text-primary outline-none transition focus:border-mint focus:ring-2 focus:ring-mint/30 placeholder:text-text-secondary"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary"
          aria-label="Clear search"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      )}
    </div>
  );
}

function match(haystack: string, needle: string) {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function LibraryTabs({ initialTab, clients, estimates, invoices, products, tz }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [q, setQ] = useState("");

  function switchTab(t: Tab) { setTab(t); setQ(""); }

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "clients",   label: "Clients",   count: clients.length   },
    { key: "estimates", label: "Estimates", count: estimates.length },
    { key: "invoices",  label: "Invoices",  count: invoices.length  },
    { key: "products",  label: "Products",  count: products.length  },
  ];

  // Filtered lists
  const filteredClients = q
    ? clients.filter((c) =>
        match(c.name, q) ||
        (c.phone && match(c.phone, q)) ||
        (c.email && match(c.email, q))
      )
    : clients;

  const filteredEstimates = q
    ? estimates.filter((e) =>
        match(e.name || e.estimate_number, q) ||
        (e.client?.name && match(e.client.name, q)) ||
        match(String(e.total), q)
      )
    : estimates;

  const filteredInvoices = q
    ? invoices.filter((i) =>
        match(i.name || i.invoice_number, q) ||
        (i.client?.name && match(i.client.name, q)) ||
        match(String(i.total), q)
      )
    : invoices;

  const filteredProducts = q
    ? products.filter((p) =>
        match(p.name, q) ||
        (p.description && match(p.description, q))
      )
    : products;

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <nav className="flex gap-1 rounded-card border border-line bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => switchTab(t.key)}
            className={`flex min-h-[44px] flex-1 flex-col items-center justify-center rounded-lg text-xs font-semibold transition ${
              tab === t.key ? "bg-mint text-ink" : "text-text-secondary"
            }`}
          >
            <span className="text-[13px]">{t.label}</span>
            <span className={`text-[10px] ${tab === t.key ? "text-ink/70" : "text-text-secondary/70"}`}>
              {t.count}
            </span>
          </button>
        ))}
      </nav>

      {/* Search bar */}
      <SearchBar
        value={q}
        onChange={setQ}
        placeholder={`Search ${tab}…`}
      />

      {/* Content */}
      {tab === "clients" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">
              {q ? `${filteredClients.length} of ${clients.length}` : `${clients.length} total`}
            </span>
            <LinkButton href="/clients/new" size="sm">+ Add</LinkButton>
          </div>
          {!q && <ImportContactsButton />}
          {filteredClients.length === 0 ? (
            <EmptyState title={q ? "No clients match" : "No clients yet"} subtitle={q ? "Try a different search." : "Add one manually, or pull from GoHighLevel."} />
          ) : (
            <div className="space-y-2">
              {filteredClients.map((c) => <ClientRow key={c.id} client={c} />)}
            </div>
          )}
        </div>
      )}

      {tab === "estimates" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">
              {q ? `${filteredEstimates.length} of ${estimates.length}` : `${estimates.length} total`}
            </span>
            <LinkButton href="/estimates/new" size="sm">+ New</LinkButton>
          </div>
          {!q && <ImportEstimatesButton />}
          {filteredEstimates.length === 0 ? (
            <EmptyState title={q ? "No estimates match" : "No estimates yet"} subtitle={q ? "Try a different search." : "Create your first estimate."} />
          ) : (
            <div className="space-y-2">
              {filteredEstimates.map((e) => (
                <Link key={e.id} href={`/estimates/${e.id}`}
                  className="flex items-center gap-3 rounded-card border border-line bg-white p-3 transition active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text-primary">
                      {e.name || e.estimate_number} · {formatCurrency(e.total)}
                    </p>
                    <p className="truncate text-sm text-text-secondary">
                      {e.client?.name ?? "—"} · {formatDate(e.created_at, tz)}
                      {e.viewed_at && <span className="ml-2 text-mint-dark">· 👁 Viewed</span>}
                    </p>
                  </div>
                  <EstimateBadge status={e.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "invoices" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">
              {q ? `${filteredInvoices.length} of ${invoices.length}` : `${invoices.length} total`}
            </span>
            <LinkButton href="/invoices/new" size="sm">+ New</LinkButton>
          </div>
          {!q && <ImportInvoicesButton />}
          {filteredInvoices.length === 0 ? (
            <EmptyState title={q ? "No invoices match" : "No invoices yet"} subtitle={q ? "Try a different search." : "Create one or convert from an estimate."} />
          ) : (
            <div className="space-y-2">
              {filteredInvoices.map((i) => (
                <Link key={i.id} href={`/invoices/${i.id}`}
                  className="flex items-center gap-3 rounded-card border border-line bg-white p-3 transition active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-text-primary">
                      {i.name || i.invoice_number} · {formatCurrency(i.total)}
                    </p>
                    <p className="truncate text-sm text-text-secondary">
                      {i.client?.name ?? "—"} · due {formatDate(i.due_date, tz)}
                      {i.viewed_at && <span className="ml-2 text-mint-dark">· 👁 Viewed</span>}
                    </p>
                  </div>
                  <InvoiceBadge status={i.status} />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "products" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-text-secondary">
              {q ? `${filteredProducts.length} of ${products.length}` : `${products.length} total`}
            </span>
          </div>
          {!q && <ImportProductsButton />}
          {filteredProducts.length === 0 ? (
            <EmptyState title={q ? "No products match" : "No products yet"} subtitle={q ? "Try a different search." : "Import products from GoHighLevel."} />
          ) : (
            <div className="space-y-2">
              {filteredProducts.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-card border border-line bg-white p-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-text-primary">{p.name}</p>
                    {p.description && <p className="truncate text-xs text-text-secondary">{p.description}</p>}
                  </div>
                  <span className="flex-shrink-0 font-bold text-mint-dark">{formatCurrency(p.unit_price)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
