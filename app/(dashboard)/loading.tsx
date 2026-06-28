import {
  SkeletonStatPills,
  SkeletonList,
  SkeletonHeader,
  Skeleton,
} from "@/components/ui/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between pt-2">
        <div className="space-y-1.5">
          <Skeleton className="h-3.5 w-20" />
          <Skeleton className="h-7 w-36" />
        </div>
        <Skeleton className="h-11 w-11 rounded-full" />
      </div>

      {/* Stat pills */}
      <SkeletonStatPills />

      {/* Active pipeline */}
      <div className="space-y-2">
        <SkeletonHeader />
        <SkeletonList count={3} />
      </div>

      {/* Today's schedule */}
      <div className="space-y-2">
        <SkeletonHeader />
        <SkeletonList count={2} rows={2} />
      </div>
    </div>
  );
}
