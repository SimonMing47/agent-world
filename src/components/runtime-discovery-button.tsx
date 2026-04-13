"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function RuntimeDiscoveryButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={async () => {
          setPending(true);
          setMessage(null);

          try {
            const response = await fetch("/api/runtimes/discover", { method: "POST" });
            const payload = (await response.json()) as { count: number };
            setMessage(`Refreshed ${payload.count} runtime endpoint(s).`);
            router.refresh();
          } catch {
            setMessage("Runtime discovery failed. The UI kept the last known health snapshot.");
          } finally {
            setPending(false);
          }
        }}
        className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--canvas)] transition hover:opacity-90 disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "Discovering..." : "Discover runtimes"}
      </button>
      {message ? (
        <p className="text-sm text-[var(--ink-muted)]">{message}</p>
      ) : null}
    </div>
  );
}
