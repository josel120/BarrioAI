import { ResultsSkeleton } from "@/components/SearchSkeletons";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <ResultsSkeleton />
    </div>
  );
}
