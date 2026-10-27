import { TimedLoading } from "@/components/Loading";

export default function Loading() {
  return (
    <main className="flex flex-col gap-4">
      <TimedLoading active label="Cargando" expectedMs={8000} />
    </main>
  );
}
