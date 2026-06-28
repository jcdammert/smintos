import { SkeletonList, SkeletonHeader } from "@/components/ui/Skeleton";

export default function MessagesLoading() {
  return (
    <div className="space-y-4">
      <SkeletonHeader />
      <SkeletonList count={7} rows={2} />
    </div>
  );
}
