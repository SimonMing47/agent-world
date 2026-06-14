"use client";

import Link from "next/link";
import { useState } from "react";
import { Play, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLanguageText } from "@/components/language-pack-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";

type SchedulerTickResult = {
  ok?: boolean;
  now?: string;
  forced?: boolean;
  submittedCount?: number;
  results?: Array<{
    ok?: boolean;
    blueprintId?: string;
    taskRunId?: string | null;
    status?: string;
    error?: string;
  }>;
};

export function TaskBlueprintSchedulerConsole({
  scheduledCount,
  dueCount,
}: {
  scheduledCount: number;
  dueCount: number;
}) {
  const text = useLanguageText();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<SchedulerTickResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(force: boolean) {
    setIsSubmitting(true);
    setError(null);
    setLastResult(null);
    try {
      const response = await fetch("/api/task-blueprints/scheduler/tick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const result = (await response.json()) as SchedulerTickResult;
      if (!response.ok) {
        setError("ui.taskBlueprints.scheduler.messages.failed");
        return;
      }
      setLastResult(result);
      router.refresh();
    } catch {
      setError("ui.taskBlueprints.scheduler.messages.failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  const successfulRuns = lastResult?.results?.filter((item) => item.ok && item.taskRunId) ?? [];
  const failedRuns = lastResult?.results?.filter((item) => item.ok === false) ?? [];

  return (
    <Panel>
      <PanelHeader
        eyebrow="ui.taskBlueprints.scheduler.eyebrow"
        title="ui.taskBlueprints.scheduler.title"
        description="ui.taskBlueprints.scheduler.description"
        action={
          <div className="flex flex-wrap justify-end gap-2">
            <Badge variant={scheduledCount > 0 ? "accent" : "neutral"}>
              {text("ui.taskBlueprints.scheduler.badges.scheduled", undefined, { count: scheduledCount })}
            </Badge>
            <Badge variant={dueCount > 0 ? "warning" : "neutral"}>
              {text("ui.taskBlueprints.scheduler.badges.due", undefined, { count: dueCount })}
            </Badge>
          </div>
        }
      />
      <PanelBody className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={isSubmitting || dueCount === 0}
            onClick={() => submit(false)}
          >
            <Play className="h-4 w-4" />
            {isSubmitting ? text("ui.taskBlueprints.scheduler.actions.running") : text("ui.taskBlueprints.scheduler.actions.runDue")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isSubmitting || scheduledCount === 0}
            onClick={() => submit(true)}
          >
            <RefreshCw className="h-4 w-4" />
            {isSubmitting ? text("ui.taskBlueprints.scheduler.actions.running") : text("ui.taskBlueprints.scheduler.actions.runAll")}
          </Button>
        </div>

        {error ? (
          <div className="rounded-md border border-[rgba(220,38,38,0.22)] bg-[rgba(254,242,242,0.92)] p-3 text-sm text-red-700">
            {text(error)}
          </div>
        ) : null}

        {lastResult ? (
          <div className="rounded-md border border-[var(--line)] bg-[var(--surface-muted)] p-3">
            <div className="text-sm font-medium text-[var(--ink)]">
              {text(
                lastResult.forced
                  ? "ui.taskBlueprints.scheduler.messages.forcedSubmitted"
                  : "ui.taskBlueprints.scheduler.messages.dueSubmitted",
                undefined,
                { count: lastResult.submittedCount ?? 0 },
              )}
            </div>
            {successfulRuns.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {successfulRuns.slice(0, 6).map((item) => (
                  <Button key={item.taskRunId} asChild size="sm" variant="ghost">
                    <Link href={`/task-runs/${item.taskRunId}`}>
                      {text("ui.taskBlueprints.scheduler.actions.openRun")}
                    </Link>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">
                {text("ui.taskBlueprints.scheduler.messages.noRuns")}
              </div>
            )}
            {failedRuns.length > 0 ? (
              <div className="mt-3 space-y-1 text-xs leading-5 text-red-700">
                {failedRuns.slice(0, 4).map((item) => (
                  <div key={item.blueprintId ?? item.error}>
                    {item.blueprintId ?? text("ui.taskBlueprints.scheduler.messages.unknownBlueprint")} · {item.error}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
