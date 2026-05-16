"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const sampleInputs: Record<string, Record<string, unknown>> = {
  shield_mr_review: {
    repo_id: "agentworld",
    mr_id: "481",
    diff_ref: "refs/merge-requests/481/head",
    author: "reviewer@example.com",
    target_branch: "main",
    source_commit_sha: "demo-sha-481",
  },
  daily_security_review: {
    repo_scope: "all_authorized_repositories",
    branch: "main",
    run_date: new Date().toISOString().slice(0, 10),
    repo_id: "release-team/*",
    commit_sha: "daily-demo-sha",
  },
};

export function BlueprintSubmitConsole({ blueprintId }: { blueprintId: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function submit() {
    setIsSubmitting(true);
    setError(null);
    const response = await fetch(`/api/task-blueprints/${blueprintId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestedBy: "console",
        inputPayload: sampleInputs[blueprintId] ?? {},
      }),
    });
    const result = (await response.json()) as {
      ok?: boolean;
      taskRun?: { id?: string };
      error?: string;
    };
    setIsSubmitting(false);

    if (!response.ok || !result.taskRun?.id) {
      setError(result.error ?? "任务蓝图提交失败。");
      return;
    }

    router.push(`/task-runs/${result.taskRun.id}`);
    router.refresh();
  }

  return (
    <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
            运行入口
          </div>
          <div className="mt-1 text-base font-semibold text-[var(--ink)]">从任务蓝图创建运行实例</div>
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={isSubmitting}
          className="rounded-2xl border border-[var(--line)] bg-[var(--ink)] px-4 py-2 text-sm font-medium text-[var(--canvas)] disabled:opacity-50"
        >
          {isSubmitting ? "提交中" : "创建运行"}
        </button>
      </div>
      {error ? <div className="mt-3 text-sm text-red-600">{error}</div> : null}
    </div>
  );
}
