"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";

type TaskRunOpsConsoleProps = {
  taskRunId: string;
  retryNodeId?: string;
  pendingInterventionId?: string;
};

const OPS_ACTOR = "console";

function opsTextKey(key: string) {
  return ["ui", "taskRunDetail", "opsConsole", key].join(".");
}

async function postJson(url: string, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || opsTextKey("messages.failed"));
  }
}

export function TaskRunOpsConsole(props: TaskRunOpsConsoleProps) {
  const router = useRouter();
  const text = useLanguageText();
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const runAction = (run: () => Promise<void>) => {
    startTransition(async () => {
      try {
        setMessage(null);
        await run();
        setMessage(opsTextKey("messages.completed"));
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : opsTextKey("messages.unknownError"));
      }
    });
  };

  return (
    <Panel>
      <PanelHeader
        eyebrow={opsTextKey("eyebrow")}
        title={opsTextKey("title")}
        description={opsTextKey("description")}
      />
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
            {opsTextKey("actions.tick")}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              runAction(() => postJson(`/api/task-runs/${props.taskRunId}/resume`, { requestedBy: OPS_ACTOR }))
            }
          >
            {opsTextKey("actions.resume")}
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
              {opsTextKey("actions.retry")}
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
                      resolutionNote: text(opsTextKey("resolution.approved")),
                    }),
                  )
                }
              >
                {opsTextKey("actions.approve")}
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
                      resolutionNote: text(opsTextKey("resolution.rejected")),
                    }),
                  )
                }
              >
                {opsTextKey("actions.reject")}
              </Button>
            </div>
          ) : null}
        </div>
        {message ? <div className="mt-3 text-sm text-[var(--ink-muted)]">{text(message)}</div> : null}
      </PanelBody>
    </Panel>
  );
}
