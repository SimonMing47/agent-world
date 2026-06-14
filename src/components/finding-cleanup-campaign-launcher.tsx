"use client";

import { Rocket } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

type FindingCleanupCampaignScope = "high_risk" | "overdue" | "unassigned" | "cleancode" | "all_open";

type FindingCleanupCampaignLauncherProps = {
  disabled?: boolean;
  defaultScope?: FindingCleanupCampaignScope;
  defaultTeamId?: string;
  teamOptions?: Array<{
    id: string;
    name: string;
    findingCount?: number;
  }>;
};

const scopes: FindingCleanupCampaignScope[] = ["high_risk", "overdue", "unassigned", "cleancode", "all_open"];

async function startCleanupCampaign(args: {
  scope: FindingCleanupCampaignScope;
  limit: number;
  teamId?: string;
}) {
  const response = await fetch("/api/findings/cleanup-campaigns", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    taskRunId?: string | null;
  } | null;
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error ?? "ui.taskRuns.cleanupCampaign.messages.failed");
  }
  if (!payload?.taskRunId) throw new Error("ui.taskRuns.cleanupCampaign.messages.failed");
  return payload.taskRunId;
}

export function FindingCleanupCampaignLauncher({
  disabled,
  defaultScope = "high_risk",
  defaultTeamId = "",
  teamOptions = [],
}: FindingCleanupCampaignLauncherProps) {
  const text = useLanguageText();
  const router = useRouter();
  const [scope, setScope] = useState<FindingCleanupCampaignScope>(defaultScope);
  const [teamId, setTeamId] = useState(defaultTeamId);
  const [limit, setLimit] = useState(8);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      try {
        setMessage("");
        const taskRunId = await startCleanupCampaign({ scope, limit, teamId: teamId || undefined });
        router.push(`/task-runs/${taskRunId}`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "ui.taskRuns.cleanupCampaign.messages.failed");
      }
    });
  }

  return (
    <div className="flex min-w-[280px] flex-wrap items-center justify-end gap-2">
      <Select
        className="h-9 min-w-[150px] rounded-lg px-3 text-xs"
        value={scope}
        disabled={disabled || isPending}
        aria-label={text("ui.taskRuns.cleanupCampaign.fields.scope")}
        onChange={(event) => setScope(event.target.value as FindingCleanupCampaignScope)}
      >
        {scopes.map((item) => (
          <option key={item} value={item}>
            {text(`ui.taskRuns.cleanupCampaign.scopes.${item}`)}
          </option>
        ))}
      </Select>
      {teamOptions.length ? (
        <Select
          className="h-9 min-w-[170px] rounded-lg px-3 text-xs"
          value={teamId}
          disabled={disabled || isPending}
          aria-label={text("ui.taskRuns.cleanupCampaign.fields.team")}
          onChange={(event) => setTeamId(event.target.value)}
        >
          <option value="">{text("ui.taskRuns.cleanupCampaign.fields.allTeams")}</option>
          {teamOptions.map((option) => (
            <option key={option.id} value={option.id}>
              {option.findingCount ? `${option.name} (${option.findingCount})` : option.name}
            </option>
          ))}
        </Select>
      ) : null}
      <Input
        className="h-9 w-20 rounded-lg px-3 text-xs"
        type="number"
        min={1}
        max={20}
        value={limit}
        disabled={disabled || isPending}
        aria-label={text("ui.taskRuns.cleanupCampaign.fields.limit")}
        title={text("ui.taskRuns.cleanupCampaign.fields.limit")}
        onChange={(event) => setLimit(Math.max(1, Math.min(20, Number(event.target.value) || 1)))}
      />
      <Button
        type="button"
        size="sm"
        variant="primary"
        disabled={disabled || isPending}
        title={text("ui.taskRuns.cleanupCampaign.actions.startTitle")}
        onClick={submit}
      >
        <Rocket className="h-3.5 w-3.5" />
        {isPending ? text("ui.taskRuns.cleanupCampaign.actions.starting") : text("ui.taskRuns.cleanupCampaign.actions.start")}
      </Button>
      {message ? <div className="basis-full text-right text-xs text-[var(--ink-muted)]">{text(message)}</div> : null}
    </div>
  );
}
