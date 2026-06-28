import { SkeletonList, SkeletonHeader, Skeleton } from "@/components/ui/Skeleton";

export default function ClientsLoading() {
  return (
    <div className="space-y-4">
      <SkeletonHeader hasButton />
      {/* Import button placeholder */}
      <Skeleton className="h-10 w-full rounded-card" />
      <SkeletonList count={8} rows={2} />
    </div>
  );
}
