"use client";

import Link from "next/link";
import { CheckCircle2, EyeOff, MessageSquareText, RotateCcw, UserMinus, UserPlus, UserRoundCheck, Wrench, XCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguageText } from "@/components/language-pack-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FindingTriageStatus = "open" | "fixed" | "ignored" | "false_positive";

type TaskRunFindingActionsProps = {
  taskRunId: string;
  findingId: string;
  currentStatus: string;
  feedbackPath?: string | null;
  latestFeedback?: {
    verdict: string;
    note?: string | null;
    knowledgeUri?: string | null;
    createdAt: string;
  } | null;
  assignment?: {
    assignedTo: string;
    assignedBy?: string | null;
    assignedAt: string;
    note?: string | null;
  } | null;
};

const actions: Array<{
  status: FindingTriageStatus;
  labelKey: string;
  titleKey: string;
  icon: typeof CheckCircle2;
  variant: "secondary" | "danger";
}> = [
  {
    status: "fixed",
    labelKey: "ui.taskRunDetail.findingActions.fixed",
    titleKey: "ui.taskRunDetail.findingActions.fixedTitle",
    icon: CheckCircle2,
    variant: "secondary",
  },
  {
    status: "ignored",
    labelKey: "ui.taskRunDetail.findingActions.ignored",
    titleKey: "ui.taskRunDetail.findingActions.ignoredTitle",
    icon: EyeOff,
    variant: "secondary",
  },
  {
    status: "false_positive",
    labelKey: "ui.taskRunDetail.findingActions.falsePositive",
    titleKey: "ui.taskRunDetail.findingActions.falsePositiveTitle",
    icon: XCircle,
    variant: "danger",
  },
  {
    status: "open",
    labelKey: "ui.taskRunDetail.findingActions.reopen",
    titleKey: "ui.taskRunDetail.findingActions.reopenTitle",
    icon: RotateCcw,
    variant: "secondary",
  },
];

async function postTriage(args: {
  taskRunId: string;
  findingId: string;
  status: FindingTriageStatus;
}) {
  const response = await fetch(
    `/api/task-runs/${encodeURIComponent(args.taskRunId)}/findings/${encodeURIComponent(args.findingId)}/triage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: args.status,
      }),
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "ui.taskRunDetail.findingActions.failed");
  }
}

async function postRemediation(args: {
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
    throw new Error(payload?.error ?? "ui.taskRunDetail.findingActions.remediationFailed");
  }

  const payload = (await response.json().catch(() => null)) as { taskRunId?: string | null } | null;
  if (!payload?.taskRunId) throw new Error("ui.taskRunDetail.findingActions.remediationFailed");
  return payload.taskRunId;
}

async function postAssignment(args: {
  taskRunId: string;
  findingId: string;
  action?: "claim" | "release";
  assignedTo?: string | null;
}) {
  const response = await fetch(
    `/api/task-runs/${encodeURIComponent(args.taskRunId)}/findings/${encodeURIComponent(args.findingId)}/assignment`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: args.action,
        assignedTo: args.assignedTo,
      }),
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? "ui.taskRunDetail.findingActions.assignmentFailed");
  }
}

export function TaskRunFindingActions({
  taskRunId,
  findingId,
  currentStatus,
  feedbackPath,
  latestFeedback,
  assignment,
}: TaskRunFindingActionsProps) {
  const text = useLanguageText();
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [assignee, setAssignee] = useState(assignment?.assignedTo ?? "");
  const [isPending, startTransition] = useTransition();

  function run(status: FindingTriageStatus) {
    startTransition(async () => {
      try {
        setMessage("");
        await postTriage({ taskRunId, findingId, status });
        setMessage("ui.taskRunDetail.findingActions.saved");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "ui.taskRunDetail.findingActions.failed");
      }
    });
  }

  function createRemediationTask() {
    startTransition(async () => {
      try {
        setMessage("");
        const remediationTaskRunId = await postRemediation({ taskRunId, findingId });
        router.push(`/task-runs/${remediationTaskRunId}`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "ui.taskRunDetail.findingActions.remediationFailed");
      }
    });
  }

  function updateAssignment(action: "claim" | "release") {
    startTransition(async () => {
      try {
        setMessage("");
        await postAssignment({ taskRunId, findingId, action });
        setMessage(
          action === "claim"
            ? "ui.taskRunDetail.findingActions.assignmentSaved"
            : "ui.taskRunDetail.findingActions.assignmentReleased",
        );
        if (action === "release") setAssignee("");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "ui.taskRunDetail.findingActions.assignmentFailed");
      }
    });
  }

  function assignOwner() {
    const assignedTo = assignee.trim();
    if (!assignedTo) {
      setMessage("ui.taskRunDetail.findingActions.assignRequired");
      return;
    }

    startTransition(async () => {
      try {
        setMessage("");
        await postAssignment({ taskRunId, findingId, assignedTo });
        setMessage("ui.taskRunDetail.findingActions.assignmentSaved");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "ui.taskRunDetail.findingActions.assignmentFailed");
      }
    });
  }

  const feedbackVerdict = latestFeedback
    ? text(`findingFeedback.verdict.${latestFeedback.verdict}`, latestFeedback.verdict)
    : "";
  const feedbackVariant =
    latestFeedback?.verdict === "inaccurate"
      ? "danger"
      : latestFeedback?.verdict === "accurate"
        ? "success"
        : "warning";

  return (
    <div className="min-w-[220px] space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {assignment ? (
          <Badge variant="accent" title={assignment.note ?? undefined}>
            {text("ui.taskRunDetail.findingActions.assignmentStatus", undefined, { assignee: assignment.assignedTo })}
          </Badge>
        ) : (
          <Badge variant="neutral">{text("ui.taskRunDetail.findingActions.unassigned")}</Badge>
        )}
        {latestFeedback ? (
          <Badge variant={feedbackVariant} title={latestFeedback.note ?? undefined}>
            {text("ui.taskRunDetail.findingActions.feedbackStatus", undefined, { verdict: feedbackVerdict })}
          </Badge>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <div className="flex min-w-[220px] flex-1 gap-1.5">
          <Input
            className="h-8 min-w-0 rounded-[10px] px-2.5 text-xs"
            value={assignee}
            placeholder={text("ui.taskRunDetail.findingActions.assignPlaceholder")}
            aria-label={text("ui.taskRunDetail.findingActions.assignPlaceholder")}
            disabled={isPending}
            onChange={(event) => setAssignee(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={isPending || !assignee.trim()}
            title={text("ui.taskRunDetail.findingActions.assignTitle")}
            onClick={assignOwner}
          >
            <UserPlus className="h-3.5 w-3.5" />
            {text("ui.taskRunDetail.findingActions.assign")}
          </Button>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={isPending}
          title={text("ui.taskRunDetail.findingActions.createRemediationTitle")}
          onClick={createRemediationTask}
        >
          <Wrench className="h-3.5 w-3.5" />
          {text("ui.taskRunDetail.findingActions.createRemediation")}
        </Button>
        {assignment ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            title={text("ui.taskRunDetail.findingActions.releaseTitle")}
            onClick={() => updateAssignment("release")}
          >
            <UserMinus className="h-3.5 w-3.5" />
            {text("ui.taskRunDetail.findingActions.release")}
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={isPending}
            title={text("ui.taskRunDetail.findingActions.claimTitle")}
            onClick={() => updateAssignment("claim")}
          >
            <UserRoundCheck className="h-3.5 w-3.5" />
            {text("ui.taskRunDetail.findingActions.claim")}
          </Button>
        )}
        {feedbackPath ? (
          <Button
            asChild
            size="sm"
            variant="ghost"
            title={text("ui.taskRunDetail.findingActions.feedbackTitle")}
          >
            <Link href={feedbackPath}>
              <MessageSquareText className="h-3.5 w-3.5" />
              {text("ui.taskRunDetail.findingActions.feedback")}
            </Link>
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {actions.map((action) => {
          const Icon = action.icon;
          const isCurrent = currentStatus === action.status;
          return (
            <Button
              key={action.status}
              type="button"
              size="sm"
              variant={action.variant}
              disabled={isPending || isCurrent}
              title={text(action.titleKey)}
              onClick={() => run(action.status)}
            >
              <Icon className="h-3.5 w-3.5" />
              {text(action.labelKey)}
            </Button>
          );
        })}
      </div>
      {message ? <div className="text-xs text-[var(--ink-muted)]">{text(message)}</div> : null}
    </div>
  );
}
