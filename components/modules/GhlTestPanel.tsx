"use client";

import { useState } from "react";

type TestResult = {
  ok: boolean;
  status: number;
  data: unknown;
  error: string | null;
};

type Results = Record<string, TestResult | string>;

const TESTS = [
  { key: "all", label: "Run all tests" },
  { key: "contacts", label: "Contacts API" },
  { key: "invoices", label: "Invoices API" },
  { key: "estimates", label: "Estimates API" },
  { key: "calendars", label: "Calendars API" },
  { key: "conversations", label: "Conversations API" },
];

export function GhlTestPanel({ userId: _ }: { userId: string }) {
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Results | null>(null);

  async function run(test: string) {
    setRunning(test);
    setResults(null);
    try {
      const res = await fetch(`/api/ghl-test?test=${test}`);
      const data = await res.json() as Results;
      setResults(data);
    } catch (e) {
      setResults({ error: String(e) });
    } finally {
      setRunning(null);
    }
  }

  function statusColor(r: TestResult) {
    if (r.ok) return "text-[#067a44] bg-mint/10";
    if (r.status === 401 || r.status === 403) return "text-danger bg-danger/10";
    return "text-warn bg-warn/10";
  }

  function statusLabel(r: TestResult) {
    if (r.ok) return `✓ ${r.status} OK`;
    if (r.status === 401) return `✗ 401 — API key invalid or missing scope`;
    if (r.status === 403) return `✗ 403 — Forbidden (scope not granted)`;
    if (r.status === 404) return `✗ 404 — Endpoint not found`;
    if (r.status === 422) return `✗ 422 — Validation error`;
    return `✗ ${r.status || "Network error"}`;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {TESTS.map((t) => (
          <button
            key={t.key}
            disabled={!!running}
            onClick={() => run(t.key)}
            className={`min-h-[44px] rounded-card border px-3 text-sm font-semibold transition active:scale-95 disabled:opacity-50 ${
              t.key === "all"
                ? "border-mint bg-mint text-ink"
                : "border-line bg-white text-text-primary"
            }`}
          >
            {running === t.key ? "Testing…" : t.label}
          </button>
        ))}
      </div>

      {results && (
        <div className="space-y-3">
          {Object.entries(results).map(([key, value]) => {
            if (key === "locationId" || key === "keyPreview") return null;
            if (typeof value === "string") {
              return (
                <div key={key} className="rounded-card border border-danger/30 bg-danger/5 p-3 text-sm text-danger">
                  {key}: {value}
                </div>
              );
            }
            const r = value as TestResult;
            return (
              <div key={key} className="rounded-card border border-line bg-white overflow-hidden">
                <div className={`flex items-center justify-between px-3 py-2 ${statusColor(r)}`}>
                  <span className="font-semibold capitalize">{key}</span>
                  <span className="text-xs font-semibold">{statusLabel(r)}</span>
                </div>
                {!r.ok && (
                  <div className="px-3 py-2">
                    <p className="text-xs font-semibold text-text-secondary mb-1">Error:</p>
                    <pre className="text-xs text-danger whitespace-pre-wrap break-words">
                      {JSON.stringify(r.data ?? r.error, null, 2)}
                    </pre>
                  </div>
                )}
                {r.ok && (
                  <div className="px-3 py-2">
                    <p className="text-xs font-semibold text-text-secondary mb-1">Response preview:</p>
                    <pre className="text-xs text-text-primary whitespace-pre-wrap break-words max-h-32 overflow-auto">
                      {JSON.stringify(r.data, null, 2).slice(0, 800)}
                      {JSON.stringify(r.data).length > 800 ? "\n…" : ""}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="rounded-card border border-line bg-white p-3">
        <p className="text-xs font-semibold text-text-secondary">GHL API scopes needed</p>
        <ul className="mt-2 space-y-1 text-xs text-text-secondary">
          <li>✦ <code>contacts.readonly</code> + <code>contacts.write</code></li>
          <li>✦ <code>invoices.readonly</code> + <code>invoices.write</code></li>
          <li>✦ <code>calendars.readonly</code> + <code>calendars/events.write</code></li>
          <li>✦ <code>conversations.readonly</code> + <code>conversations/messages.write</code></li>
        </ul>
        <p className="mt-2 text-xs text-text-secondary">
          If any test shows 401/403, regenerate your GHL Private Integration token and add the missing scope, then update it in Settings.
        </p>
      </div>
    </div>
  );
}
