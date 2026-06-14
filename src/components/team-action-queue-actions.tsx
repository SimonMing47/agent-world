"use client";

import Link from "next/link";
import { ExternalLink, UserRoundCheck, Wrench } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguageText } from "@/components/language-pack-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type TeamActionQueueActionsProps = {
  href: string;
  actionKey: string;
  taskRunId?: string | null;
  findingId?: string | null;
  assignment?: { assignedTo: string } | null;
  remediation?: { taskRunId: string; createdBy?: string | null; createdAt: string } | null;
  openVariant?: "primary" | "secondary" | "ghost";
};

async function claimFinding(args: {
  taskRunId: string;
  findingId: string;
}) {
  const response = await fetch(
    `/api/task-runs/${encodeURIComponent(args.taskRunId)}/findings/${encodeURIComponent(args.findingId)}/assignment`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "claim" }),
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "ui.taskRuns.actionQueue.inlineActions.claimFailed");
  }
}

async function createFixTask(args: {
  taskRunId: string;
  findingId: string;
}) {
  const response = await fetch(
    `/api/task-runs/${encodeURIComponent(args.taskRunId)}/findings/${encodeURIComponent(args.findingId)}/remediation`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "ui.taskRuns.actionQueue.inlineActions.createFixFailed");
  }

  const payload = (await response.json().catch(() => null)) as { taskRunId?: string | null } | null;
  if (!payload?.taskRunId) throw new Error("ui.taskRuns.actionQueue.inlineActions.createFixFailed");
  return payload.taskRunId;
}

export function TeamActionQueueActions({
  href,
  actionKey,
  taskRunId,
  findingId,
  assignment,
  remediation,
  openVariant = "secondary",
}: TeamActionQueueActionsProps) {
  const text = useLanguageText();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const canClaim = Boolean(taskRunId && findingId && !assignment);
  const canCreateFixTask = Boolean(taskRunId && findingId && assignment && !remediation);

  function claim() {
    if (!taskRunId || !findingId) return;
    startTransition(async () => {
      try {
        setMessage("");
        await claimFinding({ taskRunId, findingId });
        setMessage("ui.taskRuns.actionQueue.inlineActions.claimSaved");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "ui.taskRuns.actionQueue.inlineActions.claimFailed");
      }
    });
  }

  function createFix() {
    if (!taskRunId || !findingId) return;
    startTransition(async () => {
      try {
        setMessage("");
        const remediationTaskRunId = await createFixTask({ taskRunId, findingId });
        router.push(`/task-runs/${remediationTaskRunId}`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "ui.taskRuns.actionQueue.inlineActions.createFixFailed");
      }
    });
  }

  return (
    <div className="flex min-w-[190px] flex-col items-end gap-1.5">
      <div className="flex flex-wrap justify-end gap-1.5">
        {assignment ? (
          <Badge variant="accent">
            {text("ui.taskRuns.actionQueue.inlineActions.assigned", undefined, { assignee: assignment.assignedTo })}
          </Badge>
        ) : null}
        {remediation ? (
          <Badge variant="success">
            {text("ui.taskRuns.actionQueue.inlineActions.fixTaskReady")}
          </Badge>
        ) : null}
        {canClaim ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            title={text("ui.taskRuns.actionQueue.inlineActions.claimTitle")}
            onClick={claim}
          >
            <UserRoundCheck className="h-3.5 w-3.5" />
            {isPending
              ? text("ui.taskRuns.actionQueue.inlineActions.claiming")
              : text("ui.taskRuns.actionQueue.inlineActions.claim")}
          </Button>
        ) : null}
        {canCreateFixTask ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending}
            title={text("ui.taskRuns.actionQueue.inlineActions.createFixTitle")}
            onClick={createFix}
          >
            <Wrench className="h-3.5 w-3.5" />
            {isPending
              ? text("ui.taskRuns.actionQueue.inlineActions.creatingFix")
              : text("ui.taskRuns.actionQueue.inlineActions.createFix")}
          </Button>
        ) : null}
        {remediation ? (
          <Button asChild size="sm" variant="secondary" title={text("ui.taskRuns.actionQueue.inlineActions.openFixTitle")}>
            <Link href={`/task-runs/${remediation.taskRunId}`}>
              <Wrench className="h-3.5 w-3.5" />
              {text("ui.taskRuns.actionQueue.inlineActions.openFix")}
            </Link>
          </Button>
        ) : null}
        <Button asChild size="sm" variant={openVariant}>
          <Link href={href}>
            <ExternalLink className="h-3.5 w-3.5" />
            {text(actionKey)}
          </Link>
        </Button>
      </div>
      {message ? <div className="max-w-[240px] text-right text-xs text-[var(--ink-muted)]">{text(message)}</div> : null}
    </div>
  );
}
