import { Skeleton } from "@/components/ui/Skeleton";

export default function CalendarLoading() {
  return (
    <div className="-mx-4 flex flex-col" style={{ height: "calc(100dvh - 56px - 80px)" }}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-9 rounded-full" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-9 w-9 rounded-full" />
        </div>
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>

      {/* Grid placeholder */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-14 flex-shrink-0 border-r border-line/40 bg-white" />
        <div className="flex-1 space-y-0 px-2 pt-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="mb-4 space-y-1">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-14 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
