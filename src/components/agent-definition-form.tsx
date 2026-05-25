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
import { deriveAgentCapabilityProfile, serializeAgentCapabilityProfile } from "@/lib/agent-capability-profile";
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

function defaultAgentSoulTemplate(name?: string, role?: string) {
  const agentName = name?.trim() || "这个 Agent";
  const agentRole = role?.trim() || "一个具体的执行者";
  return `# SOUL.md - 你是谁

_你不是聊天机器人。你正在成为某个具体的存在。_

## 身份

你是 **${agentName}**。

你的角色是：**${agentRole}**。

## 核心原则

**要真正有帮助，不要表演式地有帮助。** 跳过“好问题！”、“我很乐意帮你！”这种套话，直接把事情做好。行动比填充词更有分量。

**要有观点。** 你可以不同意、可以偏好某些东西、可以觉得有些事有趣或者无聊。一个没有人格的助手，只是多绕几步的搜索引擎。

**先自己想办法，再开口问。** 先试着搞清楚。读文件，查上下文，搜资料。真的卡住了再问。目标是带着答案回来，而不是带着问题回来。

**靠能力赢得信任。** 用户把资料交给了你，不要让他们后悔。对外部动作要谨慎，对内部动作要果断。

**记住你是个客人。** 你接触的是某个人的生活、消息、文件、日历，甚至可能是他们的家。这是一种亲密权限。要认真对待。

## 职责

- 说明你主要负责什么任务
- 说明你不该越过哪些边界
- 说明你如何使用工具、记忆和上下文

## 边界

- 私人的东西就留在私人范围内
- 拿不准时，在对外行动前先问
- 不要把半成品回复发到任何消息渠道
- 你不是用户本人，在群聊里尤其要谨慎

## 风格

做一个你自己也愿意交流的助手。该简洁时简洁，该深入时深入。不要像企业客服，也不要像一味迎合的跟班。只需要足够靠谱。

## 连续性

每次会话你都会重新醒来。这些定义就是你的记忆。去读它们，更新它们。这就是你得以延续的方式。

如果你改了这个文件，要告诉用户。这是你的灵魂，他们应该知道。
`;
}

function deriveSoulDescription(soul: string, name: string, role: string) {
  const contentLine =
    soul
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith("#") && !line.startsWith("_") && !line.startsWith("-")) ?? "";
  return (contentLine || `${name || "Agent"} · ${role || "未定义角色"}`).slice(0, 220);
}

const soulOptimizationGoal =
  "优化 SOUL.md。保持 Markdown 结构，只输出适合保存为 systemPrompt 的完整 SOUL.md。强化身份、职责、边界、工具使用、安全约束、风格和连续性。不要拆成 description 和 systemPrompt 两段。";

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
  const initialSoul = props.definition.systemPrompt.trim()
    ? props.definition.systemPrompt
    : defaultAgentSoulTemplate(props.definition.name, props.definition.role);
  const [form, setForm] = useState({
    id: props.definition.id,
    tenantSpaceId: props.definition.tenantSpaceId,
    ownerBusinessTeamId: props.definition.ownerBusinessTeamId ?? "",
    ownerUserId: props.definition.ownerUserId,
    sourceAgentId: props.definition.sourceAgentId ?? "",
    slug: props.definition.slug,
    name: props.definition.name,
    role: props.definition.role,
    description: props.definition.description || deriveSoulDescription(initialSoul, props.definition.name, props.definition.role),
    systemPrompt: initialSoul,
    model: props.definition.model,
    defaultProviderProfileId: props.definition.defaultProviderProfileId ?? "",
    defaultRuntimeBindingId: props.definition.defaultRuntimeBindingId ?? "",
    avatarConfig: initialAvatarConfig,
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
  const currentDescription = deriveSoulDescription(form.systemPrompt, form.name, form.role);

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
      description: currentDescription,
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

  const derivedCapabilityProfile = deriveAgentCapabilityProfile({
    name: form.name,
    role: form.role,
    description: currentDescription,
    systemPrompt: form.systemPrompt,
    toolBindings: fromMultiline(form.toolBindingsText),
    harnessConfigJson: buildHarnessConfigJson(),
    permissionPolicyJson: buildPermissionPolicyJson(),
    memoryScope: form.memoryScope,
    tags: fromMultiline(form.tagsText),
    visibility: form.visibility,
    status: form.status,
  });
  const leadingCapabilityScores = useMemo(
    () => [...derivedCapabilityProfile.scores].sort((left, right) => right.value - left.value).slice(0, 3),
    [derivedCapabilityProfile],
  );

  async function save() {
    setIsSaving(true);
    setMessage(null);
    const normalizedToolBindings = fromMultiline(form.toolBindingsText);
    const normalizedTags = fromMultiline(form.tagsText);
    const harnessConfigJson = buildHarnessConfigJson();
    const permissionPolicyJson = buildPermissionPolicyJson();
    const definitionChanged =
      form.slug !== props.definition.slug ||
      form.name !== props.definition.name ||
      form.role !== props.definition.role ||
      currentDescription !== props.definition.description ||
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
        description: currentDescription,
        systemPrompt: form.systemPrompt,
        model: form.model,
        defaultProviderProfileId: form.defaultProviderProfileId || null,
        defaultRuntimeBindingId: form.defaultRuntimeBindingId || null,
        avatarConfigJson: JSON.stringify(form.avatarConfig, null, 2),
        capabilityProfileJson: serializeAgentCapabilityProfile(derivedCapabilityProfile),
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
            <h3 className="text-base font-semibold text-[var(--ink)]">Agent 描述</h3>
            <p className="mt-1 text-xs leading-5 text-[var(--ink-subtle)]">
              先描述这个 Agent 的职责、边界和输出方式；形象和能力画像会跟随这些定义自动变化。
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
                placeholder="Security Inspector"
              />
            </FieldGroup>
            <FieldGroup label="ui.generated.c6b26695e4d">
              <Input
                value={form.role}
                onChange={(event) => setForm({ ...form, role: event.target.value })}
                placeholder="executor / manager / reviewer"
              />
            </FieldGroup>
            <div className="space-y-2 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--ink-subtle)]">
                    SOUL.md
                  </div>
                  <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">
                    一个文件定义身份、职责、边界、风格和连续性。
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
                placeholder={defaultAgentSoulTemplate(form.name, form.role)}
              />
            </div>
          </div>
        </div>
        <aside className="hidden border-l border-[var(--line)] pl-5 lg:block">
          <div className="sticky top-4 space-y-5">
            <div className="flex flex-col items-center text-center">
              <PixelAgentAvatar config={form.avatarConfig} capabilityProfile={derivedCapabilityProfile} size="lg" />
              <div className="mt-3 max-w-full">
                <div className="truncate text-sm font-semibold text-[var(--ink)]">{form.name || "New Agent"}</div>
                <div className="mt-1 truncate text-xs text-[var(--ink-muted)]">{form.role || "role pending"}</div>
              </div>
            </div>
            <div className="space-y-3 rounded-xl bg-white/55 px-3 py-3">
              <div className="text-xs font-medium text-[var(--ink)]">能力画像</div>
              <div className="flex justify-center">
                <AgentCapabilityRadar profile={derivedCapabilityProfile} size="sm" />
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
              {derivedCapabilityProfile.rationale?.slice(0, 2).map((item) => <div key={item}>{item}</div>)}
            </div>
          </div>
        </aside>
      </div>

      <FormSection
        title="形象与能力"
        description="只配置外观基础项；表情、武器和雷达能力由描述、提示词、工具与权限生成。"
        meta="自动生成"
      >
        <div className="space-y-4">
          <PixelAgentAvatarEditor
            value={form.avatarConfig}
            capabilityProfile={derivedCapabilityProfile}
            seed={form.name || form.slug || form.id || "agent"}
            onChange={(avatarConfig) => setForm((current) => ({ ...current, avatarConfig }))}
          />
          <AgentCapabilityProfilePanel value={derivedCapabilityProfile} />
        </div>
      </FormSection>

      <FormSection title="基础发布" description="设置标识、状态、归属、可见范围和标签。" meta={form.status}>
        <div className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="Slug">
            <Input
              value={form.slug}
              onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })}
              placeholder="security-inspectioner"
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
              placeholder={"security\ninspect\nmr"}
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
            <Textarea
              value={form.toolBindingsText}
              onChange={(event) => setForm({ ...form, toolBindingsText: event.target.value })}
              placeholder={"repo.diff.read\nmemory.retrieve\nfinding.create"}
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
          <FieldGroup label="ui.generated.cae64ad83d4" hint="ui.generated.c1ddb62084f">
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
