import { SkeletonList, SkeletonHeader } from "@/components/ui/Skeleton";

export default function InvoicesLoading() {
  return (
    <div className="space-y-4">
      <SkeletonHeader />
      <SkeletonList count={6} />
    </div>
  );
}
