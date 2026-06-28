import { SkeletonList, SkeletonHeader } from "@/components/ui/Skeleton";

export default function EstimatesLoading() {
  return (
    <div className="space-y-4">
      <SkeletonHeader hasButton />
      <SkeletonList count={6} />
    </div>
  );
}
