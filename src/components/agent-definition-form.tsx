"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { AgentCapabilityProfilePanel, AgentCapabilityRadar } from "@/components/agent-capability-radar";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { PixelAgentAvatar, PixelAgentAvatarEditor } from "@/components/pixel-agent-avatar";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  agentCapabilityDimensions,
  parseAgentCapabilityProfile,
  serializeAgentCapabilityProfile,
  type AgentCapabilityKey,
  type AgentCapabilityProfile,
} from "@/lib/agent-capability-profile";
import { uiText } from "@/lib/language-pack";
import { parsePixelAgentAvatarConfig } from "@/lib/pixel-agent-avatar";

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
    avatarConfigJson: string;
    capabilityProfileJson: string;
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
  providerOptions: Array<{ id: string; name: string; defaultModel: string; models: string[] }>;
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

function uniqueValues(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
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

const soulOptimizationGoal =
  "基于当前 Agent 数据记录优化 systemPrompt/SOUL.md。只返回适合保存到 agent_definitions.system_prompt 的完整内容，不套用页面默认角色模板，不拆成 description 和 systemPrompt 两段。";

const workspaceToolOptions = [
  { value: "search_repo", label: "Search Repo" },
  { value: "read_file", label: "Read File" },
  { value: "list_dir", label: "List Directory" },
];
const registeredToolNames = new Set(workspaceToolOptions.map((tool) => tool.value));

const capabilityScoreOptions = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

function toolLabel(toolName: string) {
  return workspaceToolOptions.find((tool) => tool.value === toolName)?.label ?? toolName;
}

function registeredToolsOnly(values: string[]) {
  return values.filter((tool) => registeredToolNames.has(tool));
}

function toggleMultilineValue(value: string, item: string, checked: boolean) {
  const values = new Set(fromMultiline(value));
  if (checked) values.add(item);
  else values.delete(item);
  return Array.from(values).join("\n");
}

function updateCapabilityScore(profile: AgentCapabilityProfile, key: AgentCapabilityKey, value: number) {
  return serializeAgentCapabilityProfile({
    ...profile,
    scores: agentCapabilityDimensions.map((dimension) => {
      const current = profile.scores.find((score) => score.key === dimension.key);
      return {
        ...dimension,
        value: dimension.key === key ? value : current?.value ?? 50,
      };
    }),
  });
}

function FormSection({
  title,
  description,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string;
  description: string;
  meta?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <details
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
      className="group overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--surface-muted)]"
    >
      <summary className="list-none cursor-pointer select-none px-4 py-4 outline-none transition hover:bg-white/45 focus:bg-white/60 [&::-webkit-details-marker]:hidden">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-[var(--ink)]">{title}</h3>
              {meta ? (
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-[var(--ink-muted)]">{meta}</span>
              ) : null}
            </div>
            <p className="mt-1 text-xs leading-5 text-[var(--ink-subtle)]">{description}</p>
          </div>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--line)] bg-white text-[var(--ink-muted)] transition group-open:rotate-180">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      </summary>
      <div className="border-t border-[var(--line)] px-4 py-4">{children}</div>
    </details>
  );
}

export function AgentDefinitionForm(props: AgentDefinitionFormProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const initialHarnessConfig = parseJsonObject(
    props.definition.harnessConfigJson,
    defaultHarnessConfig(),
  );
  const initialPermissionPolicy = parseJsonObject(
    props.definition.permissionPolicyJson,
    defaultPermissionPolicy(),
  );
  const initialAvatarConfig = parsePixelAgentAvatarConfig(
    props.definition.avatarConfigJson,
    props.definition.name || props.definition.slug || props.definition.id,
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
    avatarConfig: initialAvatarConfig,
    capabilityProfileJson: props.definition.capabilityProfileJson || "{}",
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
  const modelOptions = useMemo(
    () => uniqueValues([form.model, providerHint?.defaultModel, ...(providerHint?.models ?? [])]),
    [form.model, providerHint],
  );
  const storedCapabilityProfile = useMemo(
    () => parseAgentCapabilityProfile(form.capabilityProfileJson, form.name || form.slug || form.id || "agent"),
    [form.capabilityProfileJson, form.id, form.name, form.slug],
  );
  const selectedToolBindings = fromMultiline(form.toolBindingsText);
  const selectedAllowedTools = fromMultiline(form.allowedToolNamesText);
  const selectedDeniedTools = fromMultiline(form.deniedToolNamesText);

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
        allowedToolNames: registeredToolsOnly(fromMultiline(form.allowedToolNamesText)),
        deniedToolNames: registeredToolsOnly(fromMultiline(form.deniedToolNamesText)),
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
      toolBindings: registeredToolsOnly(fromMultiline(form.toolBindingsText)),
      harnessConfigJson: buildHarnessConfigJson(),
      permissionPolicyJson: buildPermissionPolicyJson(),
      memoryScope: form.memoryScope,
      tags: fromMultiline(form.tagsText),
      visibility: form.visibility,
      status: form.status,
    };
  }

  const leadingCapabilityScores = useMemo(
    () => [...storedCapabilityProfile.scores].sort((left, right) => right.value - left.value).slice(0, 3),
    [storedCapabilityProfile],
  );

  async function save() {
    setIsSaving(true);
    setMessage(null);
    const normalizedToolBindings = registeredToolsOnly(fromMultiline(form.toolBindingsText));
    const normalizedTags = fromMultiline(form.tagsText);
    const harnessConfigJson = buildHarnessConfigJson();
    const permissionPolicyJson = buildPermissionPolicyJson();
    const capabilityProfileJson = form.capabilityProfileJson.trim() || "{}";
    try {
      JSON.parse(capabilityProfileJson);
    } catch {
      setIsSaving(false);
      setMessage("capability_profile_json 必须是有效 JSON。");
      return;
    }
    const definitionChanged =
      form.slug !== props.definition.slug ||
      form.name !== props.definition.name ||
      form.role !== props.definition.role ||
      form.description !== props.definition.description ||
      form.systemPrompt !== props.definition.systemPrompt ||
      form.model !== props.definition.model ||
      form.defaultProviderProfileId !== (props.definition.defaultProviderProfileId ?? "") ||
      form.defaultRuntimeBindingId !== (props.definition.defaultRuntimeBindingId ?? "") ||
      form.capabilityProfileJson !== props.definition.capabilityProfileJson ||
      JSON.stringify(normalizedToolBindings) !== JSON.stringify(parseStringArray(props.definition.toolBindingsJson)) ||
      harnessConfigJson !== props.definition.harnessConfigJson ||
      permissionPolicyJson !== props.definition.permissionPolicyJson ||
      form.memoryScope !== props.definition.memoryScope ||
      JSON.stringify(normalizedTags) !== JSON.stringify(parseStringArray(props.definition.tagsJson)) ||
      form.visibility !== props.definition.visibility ||
      form.status !== props.definition.status ||
      JSON.stringify([...form.shareBusinessTeamIds].sort()) !==
        JSON.stringify([...props.shareBusinessTeamIds].sort());
    const validationStatus = definitionChanged ? "untested" : form.validationStatus;
    const lastValidatedAt = definitionChanged ? null : props.definition.lastValidatedAt;
    const lastValidationSummary = definitionChanged ? null : form.lastValidationSummary || null;

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
        avatarConfigJson: JSON.stringify(form.avatarConfig, null, 2),
        capabilityProfileJson,
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
        optimizationGoal: soulOptimizationGoal,
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
    setMessage(uiText("ui.common.optimizationApplied", undefined, {
      notes: suggestion.notes.length ? `: ${suggestion.notes.join("; ")}` : "",
    }));
  }

  function onSaved() {
    props.onSaved?.();
    router.refresh();
  }

  const content = (
    <div className={props.embedded ? "space-y-4" : "space-y-5"}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-[var(--ink)]">Agent 数据记录</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--ink-subtle)]">
              名称、角色、描述和 systemPrompt 都直接来自这一条 Agent 数据，不再由页面生成默认角色模板。
            </p>
          </div>
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
                placeholder="agent-name"
              />
            </FieldGroup>
            <FieldGroup label="ui.generated.c6b26695e4d">
              <Input
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
                placeholder="role-key"
              />
            </FieldGroup>
            <FieldGroup label="ui.generated.ce5d671f7b9" className="md:col-span-2">
              <Textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="保存到 agent_definitions.description"
              />
            </FieldGroup>
            <div className="space-y-2 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--ink-subtle)]">
                    systemPrompt / SOUL.md
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                    保存到 agent_definitions.system_prompt；新建时不会自动填入页面模板。
                  </div>
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={optimize} disabled={isOptimizing}>
                  <Sparkles className="h-4 w-4" />
                  {isOptimizing ? "优化中" : "AI 优化"}
                </Button>
              </div>
              <Textarea
                className="min-h-[360px] font-mono text-xs leading-5"
                value={form.systemPrompt}
                onChange={(event) => setForm({ ...form, systemPrompt: event.target.value })}
                placeholder="从数据库记录加载；新建 Agent 时请在这里填写 systemPrompt / SOUL.md。"
              />
            </div>
          </div>
        </div>
        <aside className="hidden border-l border-[var(--line)] pl-5 lg:block">
          <div className="sticky top-4 space-y-5">
            <div className="flex flex-col items-center text-center">
              <PixelAgentAvatar config={form.avatarConfig} capabilityProfile={storedCapabilityProfile} size="lg" />
              <div className="mt-3 max-w-full">
                <div className="truncate text-sm font-semibold text-[var(--ink)]">{form.name || "New Agent"}</div>
                <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">{form.role || "role pending"}</div>
              </div>
            </div>
            <div className="space-y-3 rounded-xl bg-white/55 px-3 py-3">
              <div className="text-xs font-medium text-[var(--ink)]">能力画像</div>
              <div className="flex justify-center">
                <AgentCapabilityRadar profile={storedCapabilityProfile} size="sm" />
              </div>
              <div className="space-y-2">
                {leadingCapabilityScores.map((score) => (
                  <div key={score.key} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-[var(--ink-muted)]">{score.label}</span>
                    <span className="font-mono text-[var(--ink)]">{score.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-1 border-t border-[var(--line)] pt-3 text-xs leading-5 text-[var(--ink-muted)]">
              {storedCapabilityProfile.rationale?.slice(0, 2).map((item) => <div key={item}>{item}</div>)}
            </div>
          </div>
        </aside>
      </div>

      <FormSection
        title="形象与能力"
        description="形象与能力画像从当前 Agent 数据记录读取；页面不再根据角色关键词生成能力说明。"
        meta="来自数据库"
      >
        <div className="space-y-4">
          <PixelAgentAvatarEditor
            value={form.avatarConfig}
            capabilityProfile={storedCapabilityProfile}
            seed={form.name || form.slug || form.id || "agent"}
            onChange={(avatarConfig) => setForm((current) => ({ ...current, avatarConfig }))}
          />
          <AgentCapabilityProfilePanel value={storedCapabilityProfile} />
          <div className="grid gap-3 md:grid-cols-2">
            {agentCapabilityDimensions.map((dimension) => {
              const score = storedCapabilityProfile.scores.find((item) => item.key === dimension.key)?.value ?? 50;
              return (
                <FieldGroup key={dimension.key} label={dimension.label}>
                  <Select
                    value={String(score)}
                    onChange={(event) =>
                      setForm((current) => {
                        const currentProfile = parseAgentCapabilityProfile(
                          current.capabilityProfileJson,
                          current.name || current.slug || current.id || "agent",
                        );
                        return {
                          ...current,
                          capabilityProfileJson: updateCapabilityScore(currentProfile, dimension.key, Number(event.target.value)),
                        };
                      })
                    }
                  >
                    {capabilityScoreOptions.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </Select>
                </FieldGroup>
              );
            })}
          </div>
        </div>
      </FormSection>

      <FormSection title="基础发布" description="设置标识、状态、归属、可见范围和标签。" meta={form.status}>
        <div className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="Slug">
            <Input
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
              placeholder="agent-slug"
            />
          </FieldGroup>
          <FieldGroup label="ui.generated.c62e951a692">
            <Select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
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
            <Select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>
              {["personal", "team", "global"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
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
          <FieldGroup label="ui.generated.cae0a7afece" hint="ui.generated.cb0a3fe2b3f">
            <Textarea
              value={form.tagsText}
              onChange={(event) => setForm({ ...form, tagsText: event.target.value })}
              placeholder={"tag-one\ntag-two"}
            />
          </FieldGroup>
        </div>
      </FormSection>

      <FormSection title="模型与运行" description="配置默认模型服务、运行绑定、审批模式和工具调用上限。" meta={form.model || "未配置"}>
        <div className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="ui.generated.cbff226d7bb">
            <Select
              value={form.defaultProviderProfileId}
              onChange={(event) => {
                const provider = props.providerOptions.find((item) => item.id === event.target.value);
                const model = provider?.models.includes(provider.defaultModel)
                  ? provider.defaultModel
                  : (provider?.models[0] ?? provider?.defaultModel ?? "");
                setForm({
                  ...form,
                  defaultProviderProfileId: event.target.value,
                  model,
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
            <Select
              value={form.model}
              onChange={(event) => setForm({ ...form, model: event.target.value })}
              disabled={!providerHint}
            >
              <option value="">ui.common.unconfigured</option>
              {modelOptions.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </Select>
          </FieldGroup>
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
        </div>
      </FormSection>

      <FormSection
        title="工具与权限"
        description="工具绑定、允许/禁止工具和仓库/记忆/密钥访问都保留为可配置项。"
        meta={`${fromMultiline(form.toolBindingsText).length} 个工具`}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="ui.generated.ca9bb8be05e" hint="ui.generated.cdda0bc2a23" className="md:col-span-2">
            <div className="grid gap-2 sm:grid-cols-3">
              {workspaceToolOptions.map((tool) => (
                <label key={tool.value} className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink-muted)]">
                  <input
                    type="checkbox"
                    checked={selectedToolBindings.includes(tool.value)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        toolBindingsText: toggleMultilineValue(current.toolBindingsText, tool.value, event.target.checked),
                      }))
                    }
                  />
                  {tool.label}
                </label>
              ))}
            </div>
            {selectedToolBindings.filter((tool) => !workspaceToolOptions.some((option) => option.value === tool)).length ? (
              <div className="mt-2 text-xs text-[var(--warning)]">
                已忽略未注册工具：{selectedToolBindings.filter((tool) => !workspaceToolOptions.some((option) => option.value === tool)).join(", ")}
              </div>
            ) : null}
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
          <FieldGroup label="ui.generated.cae64ad83d4" hint="ui.generated.c1ddb62084f">
            <div className="grid gap-2">
              {workspaceToolOptions.map((tool) => (
                <label key={tool.value} className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink-muted)]">
                  <input
                    type="checkbox"
                    checked={selectedAllowedTools.includes(tool.value)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        allowedToolNamesText: toggleMultilineValue(current.allowedToolNamesText, tool.value, event.target.checked),
                      }))
                    }
                  />
                  {toolLabel(tool.value)}
                </label>
              ))}
            </div>
          </FieldGroup>
          <FieldGroup label="ui.generated.c35a905110b" hint="ui.generated.ca1312208ca" className="md:col-span-2">
            <div className="grid gap-2 sm:grid-cols-3">
              {workspaceToolOptions.map((tool) => (
                <label key={tool.value} className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm text-[var(--ink-muted)]">
                  <input
                    type="checkbox"
                    checked={selectedDeniedTools.includes(tool.value)}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        deniedToolNamesText: toggleMultilineValue(current.deniedToolNamesText, tool.value, event.target.checked),
                      }))
                    }
                  />
                  {toolLabel(tool.value)}
                </label>
              ))}
            </div>
            {selectedDeniedTools.filter((tool) => !workspaceToolOptions.some((option) => option.value === tool)).length ? (
              <div className="mt-2 text-xs text-[var(--warning)]">
                已忽略未注册工具：{selectedDeniedTools.filter((tool) => !workspaceToolOptions.some((option) => option.value === tool)).join(", ")}
              </div>
            ) : null}
          </FieldGroup>
        </div>
      </FormSection>

      <FormSection title="共享范围" description="按业务团队控制这个 Agent 的共享范围。" meta={`${form.shareBusinessTeamIds.length} 个团队`}>
        <div className="grid gap-2 sm:grid-cols-2">
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
      </FormSection>

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
