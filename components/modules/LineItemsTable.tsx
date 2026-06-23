import { formatCurrency } from "@/lib/format";
import type { LineItem } from "@/types";

export function LineItemsTable({
  items,
  total,
}: {
  items: LineItem[];
  total: number;
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-white">
      <ul className="divide-y divide-line">
        {items.length === 0 && (
          <li className="p-4 text-sm text-text-secondary">No line items.</li>
        )}
        {items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">
                {item.description || "Item"}
              </p>
              {item.notes && (
                <p className="mt-0.5 text-xs text-text-secondary leading-snug">
                  {item.notes}
                </p>
              )}
              <p className="mt-0.5 text-xs text-text-secondary">
                {item.quantity} × {formatCurrency(item.unitPrice)}
              </p>
            </div>
            <span className="text-sm font-semibold text-text-primary">
              {formatCurrency(item.quantity * item.unitPrice)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-line bg-bg p-3">
        <span className="text-sm font-medium text-text-secondary">Total</span>
        <span className="font-display text-lg font-bold text-text-primary">
          {formatCurrency(total)}
        </span>
      </div>
    </div>
  );
}
