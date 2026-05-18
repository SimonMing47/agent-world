"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useLanguageText } from "@/components/language-pack-provider";

export function RuntimeDiscoveryButton() {
  const router = useRouter();
  const text = useLanguageText();
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
            setMessage(text("ui.common.runtimeEndpointsRefreshed", undefined, { count: payload.count }));
            router.refresh();
          } catch {
            setMessage("ui.generated.c8827366c6b");
          } finally {
            setPending(false);
          }
        }}
        className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--canvas)] transition hover:opacity-90 disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "ui.generated.c6336f539ff" : "ui.generated.cb5a56eb61f"}
      </button>
      {message ? (
        <p className="text-sm text-[var(--ink-muted)]">{message}</p>
      ) : null}
    </div>
  );
}
