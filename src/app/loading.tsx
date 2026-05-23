export default function GlobalLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="h-3 w-28 animate-pulse rounded-full bg-[rgba(15,23,42,0.08)]" />
        <div className="h-10 w-[min(28rem,70%)] animate-pulse rounded-2xl bg-[rgba(15,23,42,0.12)]" />
        <div className="h-4 w-[min(42rem,82%)] animate-pulse rounded-full bg-[rgba(15,23,42,0.07)]" />
      </div>

      <div className="grid gap-4 xl:grid-cols-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-[24px] border border-white/70 bg-white/88 shadow-[var(--shadow-soft)]"
          />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
        <div className="min-h-[320px] animate-pulse rounded-[28px] border border-white/70 bg-white/92 shadow-[var(--shadow-soft)]" />
        <div className="min-h-[320px] animate-pulse rounded-[28px] border border-white/70 bg-white/92 shadow-[var(--shadow-soft)]" />
      </div>
    </div>
  );
}
