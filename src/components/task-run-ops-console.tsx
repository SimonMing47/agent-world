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
    throw new Error(text || "ui.generated.c8fdc4112a4");
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
        setMessage("ui.generated.cdf74cc3481");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "ui.generated.c09e424b5e8");
      }
    });
  };

  return (
    <Panel>
      <PanelHeader eyebrow="ui.generated.cf3ea6d345e" title="ui.generated.c0c1b35f1c4" description="ui.generated.c96220dbea8" />
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
            ui.generated.ce3cacac29e
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={() =>
              runAction(() => postJson(`/api/task-runs/${props.taskRunId}/resume`, { requestedBy: OPS_ACTOR }))
            }
          >
            ui.generated.cc6c4880a68
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
              ui.generated.c645f6f5302
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
                ui.generated.c23f7419d21
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
                ui.generated.c1c9e390d8c
              </Button>
            </div>
          ) : null}
        </div>
        {message ? <div className="mt-3 text-sm text-[var(--ink-muted)]">{message}</div> : null}
      </PanelBody>
    </Panel>
  );
}
