export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-card bg-line ${className}`} />
  );
}

export function SkeletonCard({ rows = 2 }: { rows?: number }) {
  return (
    <div className="rounded-card border border-line bg-white p-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-4 w-3/4" />
          {Array.from({ length: rows - 1 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-1/2" />
          ))}
        </div>
        <Skeleton className="h-6 w-16 flex-shrink-0 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 5, rows = 2 }: { count?: number; rows?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} rows={rows} />
      ))}
    </div>
  );
}

export function SkeletonStatPills() {
  return (
    <div className="grid grid-cols-3 gap-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-card border border-line bg-white p-3">
          <Skeleton className="mb-1.5 h-7 w-8" />
          <Skeleton className="h-3 w-full" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonHeader({ hasButton = false }: { hasButton?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <Skeleton className="h-8 w-32" />
      {hasButton && <Skeleton className="h-9 w-16 rounded-card" />}
    </div>
  );
}
