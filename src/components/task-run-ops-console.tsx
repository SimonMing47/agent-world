"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";

type TaskRunOpsConsoleProps = {
  taskRunId: string;
  retryNodeId?: string;
  pendingInterventionId?: string;
};

const OPS_ACTOR = "console";

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

export function TaskRunOpsConsole(props: TaskRunOpsConsoleProps) {
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
    <Panel>
      <PanelHeader eyebrow="Actions" title="操作控制台" description="推进运行、恢复任务和处理门禁。" />
      <PanelBody>
        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              runAction(() => postJson(`/api/task-runs/${props.taskRunId}/tick`, { requestedBy: OPS_ACTOR }))
            }
          >
            执行一轮调度 Tick
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              runAction(() => postJson(`/api/task-runs/${props.taskRunId}/resume`, { requestedBy: OPS_ACTOR }))
            }
          >
            恢复任务
          </Button>
          {props.retryNodeId ? (
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={() =>
                runAction(() =>
                  postJson(`/api/task-runs/${props.taskRunId}/nodes/${props.retryNodeId}/retry`, {
                    requestedBy: OPS_ACTOR,
                  }),
                )
              }
            >
              重试失败节点
            </Button>
          ) : null}
          {props.pendingInterventionId ? (
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="primary"
                disabled={isPending}
                onClick={() =>
                  runAction(() =>
                    postJson(`/api/task-run-interventions/${props.pendingInterventionId}/resolve`, {
                      decision: "approved",
                      resolvedBy: OPS_ACTOR,
                      resolutionNote: "Approved from task run console",
                    }),
                  )
                }
              >
                批准门禁
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={isPending}
                onClick={() =>
                  runAction(() =>
                    postJson(`/api/task-run-interventions/${props.pendingInterventionId}/resolve`, {
                      decision: "rejected",
                      resolvedBy: OPS_ACTOR,
                      resolutionNote: "Rejected from task run console",
                    }),
                  )
                }
              >
                拒绝门禁
              </Button>
            </div>
          ) : null}
        </div>
        {message ? <div className="mt-3 text-sm text-[var(--ink-muted)]">{message}</div> : null}
      </PanelBody>
    </Panel>
  );
}
