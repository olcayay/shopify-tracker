import { CardSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="space-y-4">
      <CardSkeleton lines={2} />
      <CardSkeleton lines={5} />
      <CardSkeleton lines={4} />
    </div>
  );
}
