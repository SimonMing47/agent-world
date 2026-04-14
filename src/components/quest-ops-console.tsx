"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type QuestOpsConsoleProps = {
  questId: string;
  retryNodeId?: string;
  pendingInterventionId?: string;
};

const OPS_ACTOR = "UI console";

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "请求失败");
  }
}

export function QuestOpsConsole(props: QuestOpsConsoleProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const runAction = (run: () => Promise<void>) => {
    startTransition(async () => {
      try {
        setMessage(null);
        await run();
        setMessage("操作已提交。");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "操作失败");
      }
    });
  };

  return (
    <div className="rounded-[28px] border border-[var(--line)] bg-[var(--surface-strong)] p-6">
      <div className="text-[11px] font-medium uppercase tracking-[0.22em] text-[var(--ink-muted)]">
        操作控制台
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            runAction(() => postJson(`/api/quests/${props.questId}/tick`, { requestedBy: OPS_ACTOR }))
          }
          className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left text-sm text-[var(--ink)] disabled:opacity-60"
        >
          执行一轮调度 Tick
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() =>
            runAction(() => postJson(`/api/quests/${props.questId}/resume`, { requestedBy: OPS_ACTOR }))
          }
          className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left text-sm text-[var(--ink)] disabled:opacity-60"
        >
          恢复 Quest
        </button>
        {props.retryNodeId ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              runAction(() =>
                postJson(`/api/quests/${props.questId}/nodes/${props.retryNodeId}/retry`, {
                  requestedBy: OPS_ACTOR,
                }),
              )
            }
            className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left text-sm text-[var(--ink)] disabled:opacity-60"
          >
            重试失败节点
          </button>
        ) : null}
        {props.pendingInterventionId ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                runAction(() =>
                  postJson(`/api/interventions/${props.pendingInterventionId}/resolve`, {
                    decision: "approved",
                    resolvedBy: OPS_ACTOR,
                    resolutionNote: "Approved from quest console",
                  }),
                )
              }
              className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left text-sm text-[var(--ink)] disabled:opacity-60"
            >
              批准门禁
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                runAction(() =>
                  postJson(`/api/interventions/${props.pendingInterventionId}/resolve`, {
                    decision: "rejected",
                    resolvedBy: OPS_ACTOR,
                    resolutionNote: "Rejected from quest console",
                  }),
                )
              }
              className="rounded-2xl border border-[var(--line)] bg-[var(--surface)] px-4 py-3 text-left text-sm text-[var(--ink)] disabled:opacity-60"
            >
              拒绝门禁
            </button>
          </div>
        ) : null}
      </div>
      {message ? <div className="mt-3 text-sm text-[var(--ink-muted)]">{message}</div> : null}
    </div>
  );
}
