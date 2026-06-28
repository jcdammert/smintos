import { SkeletonList, SkeletonHeader, Skeleton } from "@/components/ui/Skeleton";

export default function ScheduleLoading() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-9 w-24 rounded-card" />
      </div>
      <div className="space-y-5">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <SkeletonList count={2} rows={2} />
          </div>
        ))}
      </div>
    </div>
  );
}
