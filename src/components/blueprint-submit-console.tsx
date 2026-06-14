"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguageText } from "@/components/language-pack-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/textarea";

type CodebaseOption = {
  id: string;
  name: string;
  repositoryUrl?: string | null;
  defaultBranch?: string | null;
};

type ReadinessCheck = {
  id: string;
  status: "ok" | "warning" | "blocker";
  labelKey: string;
  detailKey: string;
};

type ReadinessSummary = {
  status: string;
  checks: ReadinessCheck[];
};

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function stringifyPayload(value: Record<string, unknown>) {
  return JSON.stringify(value, null, 2);
}

function normalizeInitialPayload(
  payload: Record<string, unknown>,
  codebases: CodebaseOption[],
) {
  const next = { ...payload };
  const defaultCodebase = codebases[0] ?? null;

  if ("run_date" in next && !next.run_date) next.run_date = todayIsoDate();
  if ("codebase_id" in next && !next.codebase_id && defaultCodebase) {
    next.codebase_id = defaultCodebase.id;
    next.codebase_name = defaultCodebase.name;
    next.branch = defaultCodebase.defaultBranch ?? "";
  }
  if ("repo_id" in next && !next.repo_id && defaultCodebase) {
    next.repo_id = defaultCodebase.name || defaultCodebase.id;
    next.repo_url = defaultCodebase.repositoryUrl ?? "";
    next.branch = defaultCodebase.defaultBranch ?? "";
  }

  return next;
}

function isPrimitiveEditable(value: unknown) {
  return value === null || ["string", "number", "boolean"].includes(typeof value);
}

function fieldLabelKey(field: string) {
  const keys: Record<string, string> = {
    repo_id: "ui.blueprintSubmit.fields.repository",
    repo_url: "ui.blueprintSubmit.fields.repositoryUrl",
    pull_request_index: "ui.blueprintSubmit.fields.pullRequest",
    mr_id: "ui.blueprintSubmit.fields.mergeRequest",
    diff_ref: "ui.blueprintSubmit.fields.diffRef",
    author: "ui.blueprintSubmit.fields.author",
    codebase_id: "ui.blueprintSubmit.fields.codebase",
    codebase_name: "ui.blueprintSubmit.fields.codebaseName",
    run_date: "ui.blueprintSubmit.fields.runDate",
    branch: "ui.blueprintSubmit.fields.branch",
  };
  return keys[field] ?? field;
}

function fieldPlaceholderKey(field: string) {
  const keys: Record<string, string> = {
    repo_id: "ui.blueprintSubmit.placeholders.repository",
    repo_url: "ui.blueprintSubmit.placeholders.repositoryUrl",
    pull_request_index: "ui.blueprintSubmit.placeholders.pullRequest",
    mr_id: "ui.blueprintSubmit.placeholders.mergeRequest",
    diff_ref: "ui.blueprintSubmit.placeholders.diffRef",
    author: "ui.blueprintSubmit.placeholders.author",
    codebase_id: "ui.blueprintSubmit.placeholders.codebase",
    codebase_name: "ui.blueprintSubmit.placeholders.codebaseName",
    run_date: "ui.blueprintSubmit.placeholders.runDate",
    branch: "ui.blueprintSubmit.placeholders.branch",
  };
  return keys[field] ?? "ui.blueprintSubmit.placeholders.generic";
}

function fieldInputType(field: string, value: unknown) {
  if (field === "run_date") return "date";
  if (typeof value === "number") return "number";
  return "text";
}

export function BlueprintSubmitConsole({
  blueprintId,
  initialPayload,
  codebases = [],
  readiness,
}: {
  blueprintId: string;
  initialPayload: Record<string, unknown>;
  codebases?: CodebaseOption[];
  readiness?: ReadinessSummary;
}) {
  const text = useLanguageText();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdTaskRunId, setCreatedTaskRunId] = useState<string | null>(null);
  const [serverBlockedChecks, setServerBlockedChecks] = useState<ReadinessCheck[]>([]);
  const [sourceRef, setSourceRef] = useState("");
  const [priority, setPriority] = useState(80);
  const [autoStart, setAutoStart] = useState(true);
  const [draft, setDraft] = useState<Record<string, unknown>>(() => normalizeInitialPayload(initialPayload, codebases));
  const [payloadText, setPayloadText] = useState(() => stringifyPayload(normalizeInitialPayload(initialPayload, codebases)));
  const router = useRouter();
  const editableFields = Object.entries(draft).filter(([, value]) => isPrimitiveEditable(value));
  const advancedFields = Object.entries(draft).filter(([, value]) => !isPrimitiveEditable(value));
  const readinessBlockers = readiness?.checks.filter((check) => check.status === "blocker") ?? [];
  const visibleBlockedChecks = serverBlockedChecks.length > 0 ? serverBlockedChecks : readinessBlockers;
  const submitDisabled = isSubmitting || readinessBlockers.length > 0;

  function syncDraft(next: Record<string, unknown>) {
    setDraft(next);
    setPayloadText(stringifyPayload(next));
  }

  function updateDraftField(field: string, value: unknown) {
    syncDraft({ ...draft, [field]: value });
  }

  function selectCodebase(field: "codebase_id" | "repo_id", value: string) {
    const codebase = codebases.find((item) => item.id === value || item.name === value);
    const next = { ...draft };
    if (field === "codebase_id") {
      next.codebase_id = codebase?.id ?? value;
      next.codebase_name = codebase?.name ?? "";
    } else {
      next.repo_id = codebase?.name || codebase?.id || value;
      next.repo_url = codebase?.repositoryUrl ?? draft.repo_url ?? "";
    }
    if (codebase?.defaultBranch) next.branch = codebase.defaultBranch;
    syncDraft(next);
  }

  function resetPayload() {
    const next = normalizeInitialPayload(initialPayload, codebases);
    setDraft(next);
    setPayloadText(stringifyPayload(next));
    setSourceRef("");
    setPriority(80);
    setAutoStart(true);
    setError(null);
    setCreatedTaskRunId(null);
    setServerBlockedChecks([]);
  }

  function updateAdvancedPayload(value: string) {
    setPayloadText(value);
    try {
      const parsed = JSON.parse(value) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        setDraft(parsed as Record<string, unknown>);
      }
    } catch {
      // Keep the raw JSON text so the user can finish editing before submit-time validation.
    }
  }

  async function submit() {
    setIsSubmitting(true);
    setError(null);
    setCreatedTaskRunId(null);
    setServerBlockedChecks([]);
    let inputPayload: Record<string, unknown>;
    try {
      inputPayload = JSON.parse(payloadText) as Record<string, unknown>;
    } catch {
      setIsSubmitting(false);
      setError("ui.blueprintSubmit.messages.invalidJson");
      return;
    }
    const response = await fetch(`/api/task-blueprints/${blueprintId}/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inputPayload,
        sourceRef: sourceRef.trim() || undefined,
        priority,
        autoStart,
      }),
    });
    const result = (await response.json()) as {
      ok?: boolean;
      taskRun?: { id?: string };
      error?: string;
      autoStart?: { ok?: boolean; skipped?: boolean; error?: string };
      readiness?: ReadinessSummary;
      blockedChecks?: ReadinessCheck[];
    };
    setIsSubmitting(false);

    if (!response.ok || !result.taskRun?.id) {
      setServerBlockedChecks(
        result.blockedChecks ??
          result.readiness?.checks.filter((check) => check.status === "blocker") ??
          [],
      );
      setError(result.error ?? "ui.blueprintSubmit.messages.submitFailed");
      return;
    }

    if (result.autoStart?.ok === false && !result.autoStart.skipped) {
      setCreatedTaskRunId(result.taskRun.id);
      setError(result.autoStart.error ?? "ui.blueprintSubmit.messages.autoStartFailed");
      return;
    }
    router.push(`/task-runs/${result.taskRun.id}`);
    router.refresh();
  }

  return (
    <Panel>
      <PanelHeader
        eyebrow="ui.blueprintSubmit.eyebrow"
        title="ui.blueprintSubmit.title"
        description="ui.blueprintSubmit.description"
        action={
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={resetPayload} disabled={isSubmitting} variant="ghost">
              {text("ui.blueprintSubmit.reset")}
            </Button>
            <Button type="button" onClick={submit} disabled={submitDisabled} variant="primary">
              {isSubmitting ? text("ui.blueprintSubmit.submitting") : text("ui.blueprintSubmit.submit")}
            </Button>
          </div>
        }
      />
      <PanelBody className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--ink-muted)]">{text("ui.blueprintSubmit.fields.sourceRef")}</span>
            <Input
              value={sourceRef}
              placeholder="ui.blueprintSubmit.placeholders.sourceRef"
              disabled={isSubmitting}
              onChange={(event) => setSourceRef(event.target.value)}
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-[var(--ink-muted)]">{text("ui.blueprintSubmit.fields.priority")}</span>
            <Input
              type="number"
              value={priority}
              min={0}
              max={100}
              disabled={isSubmitting}
              onChange={(event) => setPriority(Number(event.target.value))}
            />
          </label>
        </div>

        <label className="flex items-start gap-3 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-3">
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-[var(--line-strong)] accent-[var(--accent)]"
            checked={autoStart}
            disabled={isSubmitting}
            onChange={(event) => setAutoStart(event.target.checked)}
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-[var(--ink)]">
              {text("ui.blueprintSubmit.autoStart.label")}
            </span>
            <span className="mt-1 block text-xs leading-5 text-[var(--ink-muted)]">
              {text("ui.blueprintSubmit.autoStart.description")}
            </span>
          </span>
        </label>

        {editableFields.length > 0 ? (
          <div className="grid gap-3">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
              {text("ui.blueprintSubmit.sections.payload")}
            </div>
            {editableFields.map(([field, value]) => (
              <label key={field} className="space-y-1.5">
                <span className="text-xs font-medium text-[var(--ink-muted)]">{text(fieldLabelKey(field), field)}</span>
                {(field === "codebase_id" || field === "repo_id") && codebases.length > 0 ? (
                  <select
                    className="h-11 w-full rounded-xl border border-[rgba(15,23,42,0.06)] bg-[rgba(255,255,255,0.92)] px-4 text-sm text-[var(--ink)] shadow-[0_1px_2px_rgba(15,23,42,0.02)] outline-none transition-colors focus:border-[var(--accent)]/22 focus:ring-2 focus:ring-[var(--accent)]/10 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:opacity-70"
                    value={String(value ?? "")}
                    disabled={isSubmitting}
                    onChange={(event) => selectCodebase(field, event.target.value)}
                  >
                    <option value="">{text("ui.blueprintSubmit.options.selectCodebase")}</option>
                    {codebases.map((codebase) => (
                      <option
                        key={codebase.id}
                        value={field === "codebase_id" ? codebase.id : codebase.name || codebase.id}
                      >
                        {codebase.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <Input
                    type={fieldInputType(field, value)}
                    value={value === null ? "" : String(value)}
                    placeholder={fieldPlaceholderKey(field)}
                    disabled={isSubmitting}
                    onChange={(event) => {
                      const nextValue =
                        typeof value === "number"
                          ? Number(event.target.value)
                          : typeof value === "boolean"
                            ? event.target.value === "true"
                            : event.target.value;
                      updateDraftField(field, nextValue);
                    }}
                  />
                )}
              </label>
            ))}
          </div>
        ) : null}

        {advancedFields.length > 0 ? (
          <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--ink-muted)]">
              {text("ui.blueprintSubmit.sections.advancedFields")}
            </div>
            <div className="mt-2 space-y-2">
              {advancedFields.map(([field, value]) => (
                <div key={field} className="text-xs leading-5 text-[var(--ink-muted)]">
                  <span className="font-medium text-[var(--ink)]">{field}</span>
                  <span> · {Array.isArray(value) ? text("ui.blueprintSubmit.types.array") : text("ui.blueprintSubmit.types.object")}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <details className="rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3">
          <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">
            {text("ui.blueprintSubmit.sections.advancedJson")}
          </summary>
          <div className="mt-3 space-y-2">
            <Textarea
              className="min-h-48 font-mono text-xs"
              value={payloadText}
              disabled={isSubmitting}
              onChange={(event) => updateAdvancedPayload(event.target.value)}
            />
            <div className="text-xs leading-5 text-[var(--ink-muted)]">{text("ui.blueprintSubmit.advancedHint")}</div>
          </div>
        </details>

        {visibleBlockedChecks.length > 0 ? (
          <div className="rounded-md border border-[rgba(220,38,38,0.22)] bg-[rgba(254,242,242,0.92)] p-3 text-sm text-red-700">
            <div className="font-semibold">{text("ui.blueprintSubmit.blockedTitle")}</div>
            <div className="mt-1 text-xs leading-5">{text("ui.blueprintSubmit.blockedHint")}</div>
            <ul className="mt-2 space-y-1 text-xs leading-5">
              {visibleBlockedChecks.map((check) => (
                <li key={check.id}>
                  <span className="font-medium">{text(check.labelKey)}</span>
                  <span> - {text(check.detailKey)}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-[rgba(220,38,38,0.22)] bg-[rgba(254,242,242,0.92)] p-3 text-sm text-red-700">
            <div>{createdTaskRunId ? text("ui.blueprintSubmit.messages.runCreatedAutoStartFailed") : text(error, error)}</div>
            {createdTaskRunId ? (
              <Button asChild size="sm" variant="secondary" className="mt-3">
                <Link href={`/task-runs/${createdTaskRunId}`}>{text("ui.blueprintSubmit.actions.openRun")}</Link>
              </Button>
            ) : null}
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
