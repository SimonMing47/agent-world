"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { SlidersHorizontal, TestTube2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { uiText } from "@/lib/language-pack";

type AgentDefinitionFormProps = {
  definition: {
    id: string;
    tenantSpaceId: string;
    ownerBusinessTeamId: string | null;
    ownerUserId: string;
    sourceAgentId: string | null;
    slug: string;
    name: string;
    role: string;
    description: string;
    systemPrompt: string;
    model: string;
    defaultProviderProfileId: string | null;
    defaultRuntimeBindingId: string | null;
    toolBindingsJson: string;
    harnessConfigJson: string;
    permissionPolicyJson: string;
    memoryScope: string;
    tagsJson: string;
    visibility: string;
    status: string;
    validationStatus: string;
    lastValidatedAt: string | null;
    lastValidationSummary: string | null;
  };
  shareBusinessTeamIds: string[];
  title: string;
  businessTeamOptions: Array<{ id: string; name: string }>;
  providerOptions: Array<{ id: string; name: string; defaultModel: string }>;
  runtimeBindingOptions: Array<{ id: string; name: string; defaultProviderProfileId: string | null }>;
  embedded?: boolean;
  onSaved?: () => void;
};

function parseStringArray(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function toMultiline(value: string[]) {
  return value.join("\n");
}

function fromMultiline(value: string) {
  return value
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseJsonObject<T extends Record<string, unknown>>(value: string, fallback: T) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? ({ ...fallback, ...(parsed as T) } as T)
      : fallback;
  } catch {
    return fallback;
  }
}

function defaultHarnessConfig() {
  return {
    approvalMode: "allow",
    humanIntervention: "steer",
    thinkingLevel: "medium",
    maxToolCalls: 6,
  };
}

function defaultPermissionPolicy() {
  return {
    repositoryAccess: "read_only",
    memoryAccess: "inherit",
    secretAccess: "runtime_bound_only",
    allowedToolNames: ["search_repo", "read_file", "list_dir"],
    deniedToolNames: [] as string[],
  };
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function definitionFingerprint(input: {
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  model: string;
  defaultProviderProfileId: string | null;
  defaultRuntimeBindingId: string | null;
  toolBindings: string[];
  harnessConfigJson: string;
  permissionPolicyJson: string;
  memoryScope: string;
  tags: string[];
  visibility: string;
  status: string;
}) {
  return JSON.stringify(input);
}

export function AgentDefinitionForm(props: AgentDefinitionFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [optimizationGoal, setOptimizationGoal] = useState(uiText("ui.common.optimizationGoalDefault"));
  const [testPrompt, setTestPrompt] = useState(uiText("ui.common.agentTestPromptDefault"));
  const [testResult, setTestResult] = useState<null | {
    status: string;
    outputText: string;
    thinkingText: string;
    toolResults: Array<{ toolName: string; text: string; isError: boolean }>;
    responseModel: string;
  }>(null);
  const [lastValidatedAtDraft, setLastValidatedAtDraft] = useState<string | null>(
    props.definition.lastValidatedAt,
  );
  const [lastTestFingerprint, setLastTestFingerprint] = useState<string | null>(null);
  const initialHarnessConfig = parseJsonObject(
    props.definition.harnessConfigJson,
    defaultHarnessConfig(),
  );
  const initialPermissionPolicy = parseJsonObject(
    props.definition.permissionPolicyJson,
    defaultPermissionPolicy(),
  );

  const [form, setForm] = useState({
    id: props.definition.id,
    tenantSpaceId: props.definition.tenantSpaceId,
    ownerBusinessTeamId: props.definition.ownerBusinessTeamId ?? "",
    ownerUserId: props.definition.ownerUserId,
    sourceAgentId: props.definition.sourceAgentId ?? "",
    slug: props.definition.slug,
    name: props.definition.name,
    role: props.definition.role,
    description: props.definition.description,
    systemPrompt: props.definition.systemPrompt,
    model: props.definition.model,
    defaultProviderProfileId: props.definition.defaultProviderProfileId ?? "",
    defaultRuntimeBindingId: props.definition.defaultRuntimeBindingId ?? "",
    toolBindingsText: toMultiline(parseStringArray(props.definition.toolBindingsJson)),
    harnessApprovalMode: initialHarnessConfig.approvalMode,
    harnessHumanIntervention: initialHarnessConfig.humanIntervention,
    harnessThinkingLevel: initialHarnessConfig.thinkingLevel,
    harnessMaxToolCalls: String(initialHarnessConfig.maxToolCalls),
    permissionRepositoryAccess: initialPermissionPolicy.repositoryAccess,
    permissionMemoryAccess: initialPermissionPolicy.memoryAccess,
    permissionSecretAccess: initialPermissionPolicy.secretAccess,
    allowedToolNamesText: toMultiline(initialPermissionPolicy.allowedToolNames),
    deniedToolNamesText: toMultiline(initialPermissionPolicy.deniedToolNames),
    memoryScope: props.definition.memoryScope,
    tagsText: toMultiline(parseStringArray(props.definition.tagsJson)),
    visibility: props.definition.visibility,
    status: props.definition.status,
    validationStatus: props.definition.validationStatus,
    lastValidationSummary: props.definition.lastValidationSummary ?? "",
    shareBusinessTeamIds: props.shareBusinessTeamIds,
  });

  const providerHint = useMemo(
    () =>
      props.providerOptions.find((provider) => provider.id === form.defaultProviderProfileId) ?? null,
    [form.defaultProviderProfileId, props.providerOptions],
  );

  function buildHarnessConfigJson() {
    return JSON.stringify(
      {
        approvalMode: form.harnessApprovalMode,
        humanIntervention: form.harnessHumanIntervention,
        thinkingLevel: form.harnessThinkingLevel,
        maxToolCalls: Number(form.harnessMaxToolCalls || 0),
      },
      null,
      2,
    );
  }

  function buildPermissionPolicyJson() {
    return JSON.stringify(
      {
        repositoryAccess: form.permissionRepositoryAccess,
        memoryAccess: form.permissionMemoryAccess,
        secretAccess: form.permissionSecretAccess,
        allowedToolNames: fromMultiline(form.allowedToolNamesText),
        deniedToolNames: fromMultiline(form.deniedToolNamesText),
      },
      null,
      2,
    );
  }

  function buildDraftPayload() {
    return {
      id: form.id || undefined,
      tenantSpaceId: form.tenantSpaceId,
      ownerBusinessTeamId: form.ownerBusinessTeamId || null,
      ownerUserId: form.ownerUserId || "console",
      name: form.name,
      role: form.role,
      description: form.description,
      systemPrompt: form.systemPrompt,
      model: form.model,
      defaultProviderProfileId: form.defaultProviderProfileId || null,
      defaultRuntimeBindingId: form.defaultRuntimeBindingId || null,
      toolBindings: fromMultiline(form.toolBindingsText),
      harnessConfigJson: buildHarnessConfigJson(),
      permissionPolicyJson: buildPermissionPolicyJson(),
      memoryScope: form.memoryScope,
      tags: fromMultiline(form.tagsText),
      visibility: form.visibility,
      status: form.status,
    };
  }

  async function save() {
    setIsSaving(true);
    setMessage(null);
    const normalizedToolBindings = fromMultiline(form.toolBindingsText);
    const normalizedTags = fromMultiline(form.tagsText);
    const harnessConfigJson = buildHarnessConfigJson();
    const permissionPolicyJson = buildPermissionPolicyJson();
    const currentFingerprint = definitionFingerprint({
      name: form.name,
      role: form.role,
      description: form.description,
      systemPrompt: form.systemPrompt,
      model: form.model,
      defaultProviderProfileId: form.defaultProviderProfileId || null,
      defaultRuntimeBindingId: form.defaultRuntimeBindingId || null,
      toolBindings: normalizedToolBindings,
      harnessConfigJson,
      permissionPolicyJson,
      memoryScope: form.memoryScope,
      tags: normalizedTags,
      visibility: form.visibility,
      status: form.status,
    });
    const definitionChanged =
      form.slug !== props.definition.slug ||
      form.name !== props.definition.name ||
      form.role !== props.definition.role ||
      form.description !== props.definition.description ||
      form.systemPrompt !== props.definition.systemPrompt ||
      form.model !== props.definition.model ||
      form.defaultProviderProfileId !== (props.definition.defaultProviderProfileId ?? "") ||
      form.defaultRuntimeBindingId !== (props.definition.defaultRuntimeBindingId ?? "") ||
      JSON.stringify(normalizedToolBindings) !== JSON.stringify(parseStringArray(props.definition.toolBindingsJson)) ||
      harnessConfigJson !== props.definition.harnessConfigJson ||
      permissionPolicyJson !== props.definition.permissionPolicyJson ||
      form.memoryScope !== props.definition.memoryScope ||
      JSON.stringify(normalizedTags) !== JSON.stringify(parseStringArray(props.definition.tagsJson)) ||
      form.visibility !== props.definition.visibility ||
      form.status !== props.definition.status ||
      JSON.stringify([...form.shareBusinessTeamIds].sort()) !==
        JSON.stringify([...props.shareBusinessTeamIds].sort());
    const hasCurrentSuccessfulTest = Boolean(testResult) && lastTestFingerprint === currentFingerprint;
    const currentValidatedResult = hasCurrentSuccessfulTest ? testResult : null;
    const validationStatus = hasCurrentSuccessfulTest ? "passed" : definitionChanged ? "untested" : form.validationStatus;
    const lastValidatedAt = hasCurrentSuccessfulTest
      ? lastValidatedAtDraft ?? new Date().toISOString()
      : definitionChanged
        ? null
        : lastValidatedAtDraft;
    const lastValidationSummary = currentValidatedResult
      ? currentValidatedResult.outputText.slice(0, 180)
      : definitionChanged
        ? null
        : form.lastValidationSummary || null;

    const response = await fetch("/api/agent-definitions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: form.id || crypto.randomUUID(),
        tenantSpaceId: form.tenantSpaceId,
        ownerBusinessTeamId: form.ownerBusinessTeamId || null,
        ownerUserId: form.ownerUserId || "console",
        sourceAgentId: form.sourceAgentId || null,
        slug: form.slug || slugify(form.name) || `agent-${crypto.randomUUID().slice(0, 8)}`,
        name: form.name,
        role: form.role,
        description: form.description,
        systemPrompt: form.systemPrompt,
        model: form.model,
        defaultProviderProfileId: form.defaultProviderProfileId || null,
        defaultRuntimeBindingId: form.defaultRuntimeBindingId || null,
        toolBindingsJson: JSON.stringify(normalizedToolBindings, null, 2),
        harnessConfigJson,
        permissionPolicyJson,
        memoryScope: form.memoryScope,
        tagsJson: JSON.stringify(normalizedTags, null, 2),
        visibility: form.visibility,
        status: form.status,
        validationStatus,
        lastValidatedAt,
        lastValidationSummary,
        shareBusinessTeamIds: form.shareBusinessTeamIds,
      }),
    });

    setIsSaving(false);
    if (!response.ok) {
      const payload = (await response.json()) as { error?: string };
      setMessage(payload.error ?? "ui.generated.c40525a7328");
      return;
    }

    setMessage("ui.generated.cab1a00ce4f");
    onSaved();
  }

  async function optimize() {
    setIsOptimizing(true);
    setMessage(null);
    const response = await fetch("/api/agent-definitions/optimize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        definition: buildDraftPayload(),
        optimizationGoal,
      }),
    });

    setIsOptimizing(false);
    const payload = (await response.json()) as {
      ok: boolean;
      error?: string;
      result?: {
        suggestion: {
          slug: string;
          name: string;
          role: string;
          description: string;
          systemPrompt: string;
          testPrompt: string;
          notes: string[];
        };
      };
    };

    if (!response.ok || !payload.result) {
      setMessage(payload.error ?? "ui.generated.cd7578f63b2");
      return;
    }

    const suggestion = payload.result.suggestion;
    setForm((current) => ({
      ...current,
      slug: suggestion.slug || current.slug,
      name: suggestion.name || current.name,
      role: suggestion.role || current.role,
      description: suggestion.description || current.description,
      systemPrompt: suggestion.systemPrompt || current.systemPrompt,
    }));
    if (suggestion.testPrompt) {
      setTestPrompt(suggestion.testPrompt);
    }
    setMessage(uiText("ui.common.optimizationApplied", undefined, {
      notes: suggestion.notes.length ? `: ${suggestion.notes.join("; ")}` : "",
    }));
  }

  async function testDefinition() {
    setIsTesting(true);
    setMessage(null);
    setTestResult(null);

    const response = await fetch("/api/agent-definitions/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        definition: buildDraftPayload(),
        testPrompt,
        persistValidation: false,
      }),
    });

    setIsTesting(false);
    const payload = (await response.json()) as {
      ok: boolean;
      error?: string;
      result?: {
        status: string;
        outputText: string;
        thinkingText: string;
        toolResults: Array<{ toolName: string; text: string; isError: boolean }>;
        responseModel: string;
      };
    };

    if (!response.ok || !payload.result) {
      setForm((current) => ({
        ...current,
        validationStatus: "failed",
        lastValidationSummary: payload.error ?? "ui.generated.c4184cd88d1",
      }));
      setMessage(payload.error ?? "ui.generated.c31231e79d7");
      return;
    }

    setForm((current) => ({
      ...current,
      validationStatus: "passed",
      lastValidationSummary: payload.result?.outputText.slice(0, 180) ?? current.lastValidationSummary,
    }));
    setLastValidatedAtDraft(new Date().toISOString());
    setLastTestFingerprint(
      definitionFingerprint({
        name: buildDraftPayload().name,
        role: buildDraftPayload().role,
        description: buildDraftPayload().description,
        systemPrompt: buildDraftPayload().systemPrompt,
        model: buildDraftPayload().model,
        defaultProviderProfileId: buildDraftPayload().defaultProviderProfileId ?? null,
        defaultRuntimeBindingId: buildDraftPayload().defaultRuntimeBindingId ?? null,
        toolBindings: buildDraftPayload().toolBindings,
        harnessConfigJson: buildDraftPayload().harnessConfigJson,
        permissionPolicyJson: buildDraftPayload().permissionPolicyJson,
        memoryScope: buildDraftPayload().memoryScope,
        tags: buildDraftPayload().tags,
        visibility: buildDraftPayload().visibility,
        status: buildDraftPayload().status,
      }),
    );
    setTestResult(payload.result);
    setMessage("ui.generated.c267bb66d3a");
  }

  function onSaved() {
    props.onSaved?.();
    router.refresh();
  }

  const content = (
    <div className={props.embedded ? "space-y-5" : "space-y-6"}>
      <div className="grid gap-3 md:grid-cols-2">
        <FieldGroup label="ui.generated.c77666602cc">
          <Input
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                name: event.target.value,
                slug: current.id ? current.slug : slugify(event.target.value),
              }))
            }
            placeholder="Security Reviewer"
          />
        </FieldGroup>
        <FieldGroup label="Slug">
          <Input
            value={form.slug}
            onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
            placeholder="security-reviewer"
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.c6b26695e4d">
          <Input
            value={form.role}
            onChange={(event) => setForm({ ...form, role: event.target.value })}
            placeholder="reviewer"
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.c62e951a692">
          <Select
            value={form.status}
            onChange={(event) => setForm({ ...form, status: event.target.value })}
          >
            {["draft", "ready", "disabled"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c26f30fd79b">
          <Select
            value={form.ownerBusinessTeamId}
            onChange={(event) => setForm({ ...form, ownerBusinessTeamId: event.target.value })}
          >
            <option value="">ui.generated.c8c577dc72c</option>
            {props.businessTeamOptions.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c747b74cec9">
          <Select
            value={form.visibility}
            onChange={(event) => setForm({ ...form, visibility: event.target.value })}
          >
            {["personal", "team", "global"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.cbff226d7bb">
          <Select
            value={form.defaultProviderProfileId}
            onChange={(event) => {
              const provider = props.providerOptions.find((item) => item.id === event.target.value);
              setForm({
                ...form,
                defaultProviderProfileId: event.target.value,
                model: provider?.defaultModel ?? form.model,
              });
            }}
          >
            <option value="">ui.generated.c382f4b5559</option>
            {props.providerOptions.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c53215c3826">
          <Select
            value={form.defaultRuntimeBindingId}
            onChange={(event) => setForm({ ...form, defaultRuntimeBindingId: event.target.value })}
          >
            <option value="">ui.generated.c382f4b5559</option>
            {props.runtimeBindingOptions.map((binding) => (
              <option key={binding.id} value={binding.id}>
                {binding.name}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.c98fd0cbd9c">
          <Input
            value={form.model}
            onChange={(event) => setForm({ ...form, model: event.target.value })}
            placeholder={providerHint?.defaultModel ?? "ui.common.unconfigured"}
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.cb303d0833d">
          <Select
            value={form.memoryScope}
            onChange={(event) => setForm({ ...form, memoryScope: event.target.value })}
          >
            {["private", "team_shared", "global"].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
        </FieldGroup>
        <FieldGroup label="ui.generated.ce5d671f7b9" className="md:col-span-2">
          <Textarea
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
            placeholder="ui.generated.c3931148d02"
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.c1842230316" className="md:col-span-2">
          <Textarea
            className="min-h-40"
            value={form.systemPrompt}
            onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })}
            placeholder="ui.generated.c2434d8b524"
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.ca9bb8be05e" hint="ui.generated.cdda0bc2a23" className="md:col-span-2">
          <Textarea
            value={form.toolBindingsText}
            onChange={(event) => setForm({ ...form, toolBindingsText: event.target.value })}
            placeholder={"repo.diff.read\nmemory.retrieve\nfinding.create"}
          />
        </FieldGroup>
        <FieldGroup label="ui.generated.cae0a7afece" hint="ui.generated.cb0a3fe2b3f" className="md:col-span-2">
          <Textarea
            value={form.tagsText}
            onChange={(event) => setForm({ ...form, tagsText: event.target.value })}
            placeholder={"security\nreview\nmr"}
          />
        </FieldGroup>
      </div>

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.cf3c49831c6"
          title="ui.generated.c9b167bacc3"
          description="ui.generated.cf5a9a45fff"
        />
        <PanelBody className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="ui.generated.c1072712e57">
            <Select
              value={form.harnessApprovalMode}
              onChange={(event) => setForm({ ...form, harnessApprovalMode: event.target.value })}
            >
              {["allow", "ask", "deny", "manual"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="ui.generated.c66778fdee4">
            <Select
              value={form.harnessThinkingLevel}
              onChange={(event) => setForm({ ...form, harnessThinkingLevel: event.target.value })}
            >
              {["low", "medium", "high"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="ui.generated.c8d8f100fb8">
            <Select
              value={form.harnessHumanIntervention}
              onChange={(event) => setForm({ ...form, harnessHumanIntervention: event.target.value })}
            >
              {["steer", "follow_up", "disabled"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="ui.generated.c1d5b5d429d">
            <Input
              type="number"
              min="0"
              max="50"
              value={form.harnessMaxToolCalls}
              onChange={(event) => setForm({ ...form, harnessMaxToolCalls: event.target.value })}
            />
          </FieldGroup>
          <FieldGroup label="ui.generated.cbd88dd3a1e">
            <Select
              value={form.permissionRepositoryAccess}
              onChange={(event) => setForm({ ...form, permissionRepositoryAccess: event.target.value })}
            >
              {["read_only", "disabled"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="ui.generated.ca3ecb68a4c">
            <Select
              value={form.permissionMemoryAccess}
              onChange={(event) => setForm({ ...form, permissionMemoryAccess: event.target.value })}
            >
              {["inherit", "private_only", "team_shared", "global"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="ui.generated.cfd93ad7cdf">
            <Select
              value={form.permissionSecretAccess}
              onChange={(event) => setForm({ ...form, permissionSecretAccess: event.target.value })}
            >
              {["inherit", "runtime_bound_only", "none"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <div />
          <FieldGroup label="ui.generated.cae64ad83d4" hint="ui.generated.c1ddb62084f" className="md:col-span-2">
            <Textarea
              value={form.allowedToolNamesText}
              onChange={(event) => setForm({ ...form, allowedToolNamesText: event.target.value })}
              placeholder={"search_repo\nread_file\nlist_dir"}
            />
          </FieldGroup>
          <FieldGroup label="ui.generated.c35a905110b" hint="ui.generated.ca1312208ca" className="md:col-span-2">
            <Textarea
              value={form.deniedToolNamesText}
              onChange={(event) => setForm({ ...form, deniedToolNamesText: event.target.value })}
              placeholder={"write_file\nrun_shell"}
            />
          </FieldGroup>
        </PanelBody>
      </Panel>

      <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4">
        <div className="text-sm font-medium text-[var(--ink)]">ui.generated.c21a61d9642</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {props.businessTeamOptions.map((team) => (
            <label key={team.id} className="flex items-center gap-2 text-sm text-[var(--ink-muted)]">
              <input
                type="checkbox"
                checked={form.shareBusinessTeamIds.includes(team.id)}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    shareBusinessTeamIds: event.target.checked
                      ? [...current.shareBusinessTeamIds, team.id]
                      : current.shareBusinessTeamIds.filter((item) => item !== team.id),
                  }))
                }
              />
              {team.name}
            </label>
          ))}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
            <SlidersHorizontal className="h-4 w-4" />
            ui.generated.c7fe8188a1b
          </div>
          <div className="mt-3 space-y-3">
            <Textarea
              value={optimizationGoal}
              onChange={(event) => setOptimizationGoal(event.target.value)}
              placeholder="ui.generated.c6a7c4e0826"
            />
            <Button type="button" variant="secondary" onClick={optimize} disabled={isOptimizing}>
              {isOptimizing ? "ui.generated.c074e1e7d25" : "ui.generated.c9a7c14740d"}
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
            <TestTube2 className="h-4 w-4" />
            ui.generated.cb59b0fa8a4
          </div>
          <div className="mt-3 space-y-3">
            <Textarea
              value={testPrompt}
              onChange={(event) => setTestPrompt(event.target.value)}
              placeholder="ui.generated.ce719796d6b"
            />
            <Button type="button" variant="secondary" onClick={testDefinition} disabled={isTesting}>
              {isTesting ? "ui.generated.c07ca93228c" : "ui.generated.c2b74726a9b"}
            </Button>
          </div>
        </div>
      </div>

      {testResult ? (
        <div className="space-y-4 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-4">
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--ink-muted)]">
            <span>ui.generated.c0ede206b03 {testResult.status}</span>
            <span>ui.generated.c85acf18054 {testResult.responseModel}</span>
          </div>
          <div>
            <div className="text-sm font-medium text-[var(--ink)]">ui.generated.cded698ae1e</div>
            <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-xs leading-5 text-[var(--ink)]">
              {testResult.outputText || "ui.generated.c0be3645864"}
            </pre>
          </div>
          {testResult.thinkingText ? (
            <div>
              <div className="text-sm font-medium text-[var(--ink)]">ui.generated.cf6145bc4ca</div>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3 text-xs leading-5 text-[var(--ink-muted)]">
                {testResult.thinkingText}
              </pre>
            </div>
          ) : null}
          {testResult.toolResults.length ? (
            <div>
              <div className="text-sm font-medium text-[var(--ink)]">ui.generated.c04e28723c6</div>
              <div className="mt-2 space-y-2">
                {testResult.toolResults.map((toolResult, index) => (
                  <div key={`${toolResult.toolName}-${index}`} className="rounded-lg border border-[var(--line)] bg-[var(--surface)] p-3">
                    <div className="text-xs font-medium text-[var(--ink)]">
                      {toolResult.toolName} · {toolResult.isError ? "error" : "ok"}
                    </div>
                    <pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs leading-5 text-[var(--ink-muted)]">
                      {toolResult.text || "ui.generated.c9f616ee16e"}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-3">
        <Button type="button" onClick={save} disabled={isSaving}>
          {isSaving ? "ui.generated.ca032e8fdda" : "ui.generated.c9ddfa65322"}
        </Button>
        {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
      </div>
    </div>
  );

  if (props.embedded) {
    return content;
  }

  return (
    <Panel>
      <PanelHeader title={props.title} description="ui.generated.cbe84522358" />
      <PanelBody>{content}</PanelBody>
    </Panel>
  );
}
