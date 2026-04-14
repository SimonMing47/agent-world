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
            setMessage(`已刷新 ${payload.count} 个 runtime 端点。`);
            router.refresh();
          } catch {
            setMessage("Runtime 发现失败，界面会保留上一次健康状态快照。");
          } finally {
            setPending(false);
          }
        }}
        className="rounded-full bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--canvas)] transition hover:opacity-90 disabled:opacity-60"
        disabled={pending}
      >
        {pending ? "发现中..." : "发现 runtime"}
      </button>
      {message ? (
        <p className="text-sm text-[var(--ink-muted)]">{message}</p>
      ) : null}
    </div>
  );
}
