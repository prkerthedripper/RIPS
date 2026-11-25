export default function Loading() {
  return (
    <div className="shell py-16">
      <div className="h-6 w-32 animate-pulse rounded bg-surface-2" />
      <div className="mt-4 h-12 w-2/3 max-w-md animate-pulse rounded bg-surface-2" />
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-md border border-line bg-surface/50" />
        ))}
      </div>
    </div>
  );
}
