import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-card border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(13,31,23,0.04)] ${className}`}
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-card border border-dashed border-line bg-white px-6 py-12 text-center">
      <p className="font-display text-lg font-semibold text-text-primary">
        {title}
      </p>
      {subtitle && (
        <p className="mx-auto mt-1 max-w-xs text-sm text-text-secondary">
          {subtitle}
        </p>
      )}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-lg font-semibold text-text-primary">
        {title}
      </h2>
      {action}
    </div>
  );
}
