"use client";

import { useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, Circle, ClipboardList, Loader2, Plus, Sparkles, Target, Trash2, UserPlus, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { PixelAgentAvatar } from "@/components/pixel-agent-avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getAgentCapabilityWeapon, parseAgentCapabilityProfile } from "@/lib/agent-capability-profile";
import { defaultPixelAgentAvatarConfig, parsePixelAgentAvatarConfig } from "@/lib/pixel-agent-avatar";
import { cn } from "@/lib/utils";

type AgentDefinitionOption = {
  id: string;
  name: string;
  role: string;
  description?: string;
  systemPrompt?: string;
  avatarConfigJson?: string;
  capabilityProfileJson?: string;
  toolBindingsJson?: string;
  harnessConfigJson?: string;
  permissionPolicyJson?: string;
  memoryScope?: string;
  tagsJson?: string;
  visibility?: string;
  status?: string;
};

type AgentTeamFormProps = {
  team: {
    id: string;
    businessTeamId: string;
    slug: string;
    name: string;
    description: string;
    leaderAgentId: string | null;
    workflowType: string;
    orchestrationPrompt: string;
    workflowDefinitionJson: string;
    inputSchemaJson: string;
    outputSchemaJson: string;
    maxConcurrency: number;
    timeoutMs: number;
    successRateThreshold: number;
    pricingModelJson: string;
    visibility: string;
    defaultExecutionPolicyId: string | null;
  };
  members: Array<{
    id: string;
    agentDefinitionId: string;
    memberRole: string;
    workInstruction: string;
    position: number;
    status: string;
  }>;
  shares: Array<{
    businessTeamId: string;
    accessLevel: string;
  }>;
  businessTeamOptions: Array<{ id: string; name: string }>;
  agentDefinitionOptions: AgentDefinitionOption[];
  executionPolicyOptions: Array<{ id: string; name: string }>;
  embedded?: boolean;
  title: string;
  onSaved?: () => void;
};

type MemberDraft = AgentTeamFormProps["members"][number];

type AssemblySelectedMember = {
  agentDefinitionId: string;
  memberRole: string;
  workInstruction: string;
  status?: string;
  position?: number;
  isLeader?: boolean;
  rationale?: string;
};

type AssemblyNewAgentDraft = {
  tempId: string;
  name: string;
  role: string;
  description: string;
  systemPrompt: string;
  memberRole: string;
  workInstruction: string;
  tags?: string[];
  isLeader?: boolean;
  rationale?: string;
};

type AssemblySuggestion = {
  name?: string;
  slug?: string;
  description?: string;
  orchestrationPrompt?: string;
  workflowType?: string;
  teamStructure?: string;
  teamObjective?: string;
  aggregationMethod?: string;
  conflictResolution?: string;
  splitStrategy?: string;
  selectedMembers: AssemblySelectedMember[];
  newAgents: AssemblyNewAgentDraft[];
  notes?: string[];
};

type AssemblyProgressStatus = "pending" | "running" | "done";

type AssemblyProgressStep = {
  key: string;
  label: string;
  description: string;
  status: AssemblyProgressStatus;
};

const ASSEMBLY_PROGRESS_STEPS: Array<Omit<AssemblyProgressStep, "status">> = [
  {
    key: "intent",
    label: "读取团队意图",
    description: "把目标、说明和当前团队设置整理成组建上下文。",
  },
  {
    key: "inventory",
    label: "扫描可用 Agent",
    description: "检查现有 Agent 的角色、能力标签和可见性。",
  },
  {
    key: "gap",
    label: "分析能力缺口",
    description: "判断现有成员是否足够，必要时生成待确认的新 Agent。",
  },
  {
    key: "draft",
    label: "生成团队编队",
    description: "输出成员分工、Leader 建议和团队协作说明。",
  },
];

function createAssemblyProgress(activeIndex: number | null = null): AssemblyProgressStep[] {
  return ASSEMBLY_PROGRESS_STEPS.map((step, index) => ({
    ...step,
    status: (activeIndex === index ? "running" : "pending") as AssemblyProgressStatus,
  }));
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function parseWorkflowDefinition(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return {
      teamStructure: String(parsed.teamStructure ?? "leader_worker"),
      teamObjective: String(parsed.teamObjective ?? ""),
      aggregationMethod: String(parsed.aggregationMethod ?? "leader_summary"),
      conflictResolution: String(parsed.conflictResolution ?? "leader_decision"),
      splitStrategy: String(parsed.splitStrategy ?? ""),
    };
  } catch {
    return {
      teamStructure: "leader_worker",
      teamObjective: "",
      aggregationMethod: "leader_summary",
      conflictResolution: "leader_decision",
      splitStrategy: "",
    };
  }
}

function newMemberDraft(agentDefinitionId = ""): MemberDraft {
  return {
    id: crypto.randomUUID(),
    agentDefinitionId,
    memberRole: "member",
    workInstruction: "",
    position: 0,
    status: "active",
  };
}

function defaultTeamSoul(name: string) {
  return `# TEAM.md - 你们是谁

_你们不是一串 Agent 列表。你们是为了一个明确目标临时组成的协作团队。_

## 团队目标

根据当前团队目标完成任务，并把过程拆解为可交接、可审计、可合并的成员贡献。

## 核心原则

**先理解目标，再组建分工。** Leader 先接收指令，再根据目标和上下文决定需要哪些成员参与。

**分工要有差异。** 每个成员只处理被明确分派的局部上下文，避免全员共享无关信息。

**输出要能落地。** 每个结论都要包含判断依据、风险说明和下一步建议。${name ? `\n\n## 当前队名\n\n${name}` : ""}`;
}

function defaultHarnessConfigJson() {
  return JSON.stringify(
    {
      approvalMode: "allow",
      humanIntervention: "steer",
      thinkingLevel: "medium",
      maxToolCalls: 6,
    },
    null,
    2,
  );
}

function defaultPermissionPolicyJson() {
  return JSON.stringify(
    {
      repositoryAccess: "read_only",
      memoryAccess: "inherit",
      secretAccess: "runtime_bound_only",
      allowedToolNames: ["search_repo", "read_file", "list_dir"],
      deniedToolNames: [],
    },
    null,
    2,
  );
}

export function AgentTeamForm(props: AgentTeamFormProps) {
  const router = useRouter();
  const workflow = parseWorkflowDefinition(props.team.workflowDefinitionJson);
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isAssembling, setIsAssembling] = useState(false);
  const [isCreatingAgents, setIsCreatingAgents] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [agentDefinitionOptions, setAgentDefinitionOptions] = useState<AgentDefinitionOption[]>(props.agentDefinitionOptions);
  const [pendingAssembly, setPendingAssembly] = useState<AssemblySuggestion | null>(null);
  const [assemblyDialogOpen, setAssemblyDialogOpen] = useState(false);
  const [assemblyIntent, setAssemblyIntent] = useState(workflow.teamObjective || props.team.description || "");
  const [assemblyProgress, setAssemblyProgress] = useState<AssemblyProgressStep[]>(createAssemblyProgress());
  const [form, setForm] = useState({
    id: props.team.id,
    businessTeamId: props.team.businessTeamId,
    slug: props.team.slug,
    name: props.team.name,
    description: props.team.description,
    visibility: props.team.visibility,
    workflowType: props.team.workflowType,
    orchestrationPrompt: props.team.orchestrationPrompt || defaultTeamSoul(props.team.name),
    teamStructure: workflow.teamStructure,
    teamObjective: workflow.teamObjective,
    aggregationMethod: workflow.aggregationMethod,
    conflictResolution: workflow.conflictResolution,
    splitStrategy: workflow.splitStrategy,
    maxConcurrency: String(props.team.maxConcurrency || 4),
    timeoutMinutes: String(Math.max(1, Math.round((props.team.timeoutMs || 1_200_000) / 60_000))),
    successRateThreshold: String(Math.round((props.team.successRateThreshold || 0.9) * 100)),
    defaultExecutionPolicyId: props.team.defaultExecutionPolicyId ?? "",
  });
  const [members, setMembers] = useState<MemberDraft[]>(
    props.members.length ? props.members.slice().sort((left, right) => left.position - right.position) : [],
  );
  const [leaderMemberId, setLeaderMemberId] = useState<string | null>(props.team.leaderAgentId ?? null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [shareMap, setShareMap] = useState<Record<string, string>>(
    Object.fromEntries(props.shares.map((share) => [share.businessTeamId, share.accessLevel])),
  );
  const selectedMember = members.find((member) => member.id === selectedMemberId) ?? null;

  function buildWorkflowDefinitionJson(nextForm = form) {
    return JSON.stringify(
      {
        strategy: nextForm.workflowType,
        teamStructure: nextForm.teamStructure,
        teamObjective: nextForm.teamObjective,
        aggregationMethod: nextForm.aggregationMethod,
        conflictResolution: nextForm.conflictResolution,
        splitStrategy: nextForm.splitStrategy,
      },
      null,
      2,
    );
  }

  function updateMember(id: string, patch: Partial<MemberDraft>) {
    setMembers((current) => current.map((member) => (member.id === id ? { ...member, ...patch } : member)));
  }

  function applyAssemblySuggestion(suggestion: AssemblySuggestion, createdAgents: Array<{ tempId: string; agent: AgentDefinitionOption }> = []) {
    const createdByTempId = new Map(createdAgents.map((item) => [item.tempId, item.agent]));
    const selectedMembers = suggestion.selectedMembers.map((member, index) => ({
      ...newMemberDraft(member.agentDefinitionId),
      memberRole: member.memberRole || "member",
      workInstruction: member.workInstruction || "根据团队目标完成分派任务。",
      position: index,
      status: member.status || "active",
    }));
    const createdMembers = suggestion.newAgents
      .map((draft, index) => {
        const agent = createdByTempId.get(draft.tempId);
        if (!agent) return null;
        return {
          ...newMemberDraft(agent.id),
          memberRole: draft.memberRole || draft.role || "member",
          workInstruction: draft.workInstruction || "根据 Leader 分派的局部上下文输出可合并的专业结论。",
          position: selectedMembers.length + index,
          status: "active",
        };
      })
      .filter((member): member is MemberDraft => Boolean(member));
    const nextMembers = [...selectedMembers, ...createdMembers];
    const leaderFromSelectedIndex = suggestion.selectedMembers.findIndex((member) => member.isLeader);
    const leaderFromCreatedIndex = suggestion.newAgents.findIndex((agent) => agent.isLeader && createdByTempId.has(agent.tempId));
    const nextLeader =
      leaderFromSelectedIndex >= 0
        ? nextMembers[leaderFromSelectedIndex]
        : leaderFromCreatedIndex >= 0
          ? nextMembers[selectedMembers.length + leaderFromCreatedIndex]
          : nextMembers[0];

    setForm((current) => ({
      ...current,
      name: suggestion.name || current.name,
      slug: suggestion.slug || current.slug || slugify(suggestion.name || current.name),
      description: suggestion.description || current.description,
      workflowType: suggestion.workflowType || current.workflowType,
      teamStructure: suggestion.teamStructure || current.teamStructure,
      teamObjective: suggestion.teamObjective || current.teamObjective,
      aggregationMethod: suggestion.aggregationMethod || current.aggregationMethod,
      conflictResolution: suggestion.conflictResolution || current.conflictResolution,
      splitStrategy: suggestion.splitStrategy || current.splitStrategy,
      orchestrationPrompt: suggestion.orchestrationPrompt || current.orchestrationPrompt || defaultTeamSoul(suggestion.name || current.name),
      maxConcurrency: String(Math.max(1, Math.min(8, nextMembers.length || Number(current.maxConcurrency || 1)))),
    }));
    setMembers(nextMembers);
    setLeaderMemberId(nextLeader?.id ?? null);
    setSelectedMemberId(null);
  }

  function memberCapability(member: MemberDraft) {
    const definition = agentDefinitionOptions.find((agent) => agent.id === member.agentDefinitionId);
    return parseAgentCapabilityProfile(
      definition?.capabilityProfileJson,
      definition?.name || definition?.role || member.agentDefinitionId,
    );
  }

  function updateAssemblyProgress(activeIndex: number, finalStatus: AssemblyProgressStatus = "running") {
    setAssemblyProgress((current) =>
      current.map((step, index) => ({
        ...step,
        status: index < activeIndex ? "done" : index === activeIndex ? finalStatus : "pending",
      })),
    );
  }

  function openAssemblyDialog() {
    setAssemblyIntent(form.teamObjective || form.description || props.team.description || "");
    setAssemblyProgress(createAssemblyProgress());
    setAssemblyDialogOpen(true);
    setMessage(null);
  }

  async function assembleTeam(intentOverride = assemblyIntent) {
    const normalizedIntent = intentOverride.trim();
    const nextForm = {
      ...form,
      teamObjective: normalizedIntent || form.teamObjective,
    };
    setForm(nextForm);
    setIsAssembling(true);
    setMessage(null);
    setAssemblyDialogOpen(true);
    updateAssemblyProgress(0);
    try {
      updateAssemblyProgress(1);
      const response = await fetch("/api/agent-teams/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team: { ...nextForm, workflowDefinitionJson: buildWorkflowDefinitionJson(nextForm), members },
          availableAgents: agentDefinitionOptions.map((agent) => ({
            id: agent.id,
            name: agent.name,
            role: agent.role,
            description: agent.description,
            systemPrompt: agent.systemPrompt,
            tagsJson: agent.tagsJson,
            status: agent.status,
            visibility: agent.visibility,
          })),
        }),
      });
      updateAssemblyProgress(2);
      const payload = (await response.json()) as {
        suggestion?: AssemblySuggestion;
        error?: string;
      };
      if (!response.ok || !payload.suggestion) throw new Error(payload.error ?? "团队组建失败。");
      updateAssemblyProgress(3, "done");
      if (payload.suggestion.newAgents.length) {
        setPendingAssembly(payload.suggestion);
        setAssemblyDialogOpen(false);
        setMessage("默认模型认为现有 Agent 不完全够用，需要确认是否新增 Agent。");
        return;
      }
      applyAssemblySuggestion(payload.suggestion);
      setAssemblyDialogOpen(false);
      setMessage("已根据团队目标从现有 Agent 中完成团队组建。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "团队组建失败。");
    } finally {
      setIsAssembling(false);
    }
  }

  async function createAgentFromAssemblyDraft(draft: AssemblyNewAgentDraft) {
    const agentId = crypto.randomUUID();
    const systemPrompt = draft.systemPrompt.trim();
    if (!systemPrompt) {
      throw new Error(`新增 Agent ${draft.name} 缺少 systemPrompt，请重新组建或先手动创建 Agent。`);
    }
    const toolBindings: string[] = [];
    const tags = Array.from(new Set(["team-generated", ...(draft.tags ?? [])].map((tag) => tag.trim()).filter(Boolean)));
    const agent: AgentDefinitionOption = {
      id: agentId,
      name: draft.name,
      role: draft.role,
      description: draft.description,
      systemPrompt,
      avatarConfigJson: JSON.stringify(defaultPixelAgentAvatarConfig(`${draft.name}-${draft.role}`), null, 2),
      capabilityProfileJson: "{}",
      toolBindingsJson: JSON.stringify(toolBindings, null, 2),
      harnessConfigJson: defaultHarnessConfigJson(),
      permissionPolicyJson: defaultPermissionPolicyJson(),
      memoryScope: "private",
      tagsJson: JSON.stringify(tags, null, 2),
      visibility: "team",
      status: "draft",
    };
    const response = await fetch("/api/agent-definitions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: agent.id,
        tenantSpaceId: "",
        ownerBusinessTeamId: form.businessTeamId || null,
        ownerUserId: "console",
        sourceAgentId: null,
        slug: slugify(agent.name) || `agent-${agentId.slice(0, 8)}`,
        name: agent.name,
        role: agent.role,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        model: "",
        defaultProviderProfileId: null,
        defaultRuntimeBindingId: null,
        avatarConfigJson: agent.avatarConfigJson,
        capabilityProfileJson: agent.capabilityProfileJson,
        toolBindingsJson: agent.toolBindingsJson,
        harnessConfigJson: agent.harnessConfigJson,
        permissionPolicyJson: agent.permissionPolicyJson,
        memoryScope: agent.memoryScope,
        tagsJson: agent.tagsJson,
        visibility: agent.visibility,
        status: agent.status,
        validationStatus: "untested",
        lastValidatedAt: null,
        lastValidationSummary: null,
        shareBusinessTeamIds: [],
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!response.ok || payload.ok === false) throw new Error(payload.error ?? `新增 Agent ${draft.name} 失败。`);
    return { tempId: draft.tempId, agent };
  }

  async function confirmAssemblyWithNewAgents() {
    if (!pendingAssembly) return;
    setIsCreatingAgents(true);
    setMessage(null);
    try {
      const createdAgents: Array<{ tempId: string; agent: AgentDefinitionOption }> = [];
      for (const draft of pendingAssembly.newAgents) {
        createdAgents.push(await createAgentFromAssemblyDraft(draft));
      }
      setAgentDefinitionOptions((current) => [...createdAgents.map((item) => item.agent), ...current]);
      applyAssemblySuggestion(pendingAssembly, createdAgents);
      setPendingAssembly(null);
      setMessage(`已新增 ${createdAgents.length} 个 Agent，并完成团队组建。`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "新增 Agent 失败。");
    } finally {
      setIsCreatingAgents(false);
    }
  }

  function useExistingAgentsOnly() {
    if (!pendingAssembly) return;
    applyAssemblySuggestion({ ...pendingAssembly, newAgents: [] });
    setPendingAssembly(null);
    setMessage("已跳过新增，只使用现有 Agent 组建团队。");
  }

  async function optimizeTeam() {
    setIsOptimizing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/agent-teams/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team: { ...form, workflowDefinitionJson: buildWorkflowDefinitionJson(), members },
          optimizationGoal: "围绕当前团队目标优化团队定义，保留 TEAM.md 单文档形式，并强化 Leader 分派、成员职责和上下文隔离。",
        }),
      });
      const payload = (await response.json()) as {
        suggestion?: {
          name?: string;
          slug?: string;
          description?: string;
          orchestrationPrompt?: string;
          workflowType?: string;
          teamStructure?: string;
          teamObjective?: string;
          aggregationMethod?: string;
          conflictResolution?: string;
          splitStrategy?: string;
          members?: Array<{ memberRole?: string; workInstruction?: string; status?: string }>;
        };
        error?: string;
      };
      if (!response.ok || !payload.suggestion) throw new Error(payload.error ?? "团队配置优化失败。");
      const suggestion = payload.suggestion;
      setForm((current) => ({
        ...current,
        name: suggestion.name ?? current.name,
        slug: suggestion.slug ?? current.slug,
        description: suggestion.description ?? current.description,
        orchestrationPrompt: suggestion.orchestrationPrompt ?? current.orchestrationPrompt,
        workflowType: suggestion.workflowType ?? current.workflowType,
        teamStructure: suggestion.teamStructure ?? current.teamStructure,
        teamObjective: suggestion.teamObjective ?? current.teamObjective,
        aggregationMethod: suggestion.aggregationMethod ?? current.aggregationMethod,
        conflictResolution: suggestion.conflictResolution ?? current.conflictResolution,
        splitStrategy: suggestion.splitStrategy ?? current.splitStrategy,
      }));
      if (suggestion.members?.length) {
        setMembers((current) => {
          const base = current.length
            ? current
            : agentDefinitionOptions.slice(0, Math.min(3, agentDefinitionOptions.length)).map((definition, index) => ({
                ...newMemberDraft(definition.id),
                memberRole: definition.role || `member-${index + 1}`,
                workInstruction: "根据团队目标完成分派任务。",
                position: index,
              }));
          return base.map((member, index) => ({
            ...member,
            memberRole: suggestion.members?.[index]?.memberRole ?? member.memberRole,
            workInstruction: suggestion.members?.[index]?.workInstruction ?? member.workInstruction,
            status: suggestion.members?.[index]?.status ?? member.status,
          }));
        });
      }
      setMessage("已用默认模型优化团队配置。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "团队配置优化失败。");
    } finally {
      setIsOptimizing(false);
    }
  }

  async function persistTeam(closeAfterSave = true) {
    setIsSaving(true);
    setMessage(null);

    const normalizedMembers = members
      .filter((member) => member.agentDefinitionId.trim())
      .map((member, index) => ({
        ...member,
        position: index,
        memberRole: member.memberRole.trim() || "member",
        workInstruction: member.workInstruction.trim(),
        status: member.status || "active",
      }));
    const selectedLeaderId = normalizedMembers.find((member) => member.id === leaderMemberId)?.id ?? null;
    const normalizedShares = Object.entries(shareMap)
      .filter(([businessTeamId]) => businessTeamId.trim() && businessTeamId !== form.businessTeamId)
      .map(([businessTeamId, accessLevel]) => ({ businessTeamId, accessLevel }));

    if (!form.name.trim()) {
      setIsSaving(false);
      setMessage("名称不能为空。");
      return null;
    }
    if (!form.businessTeamId.trim()) {
      setIsSaving(false);
      setMessage("请选择业务团队。");
      return null;
    }
    if (normalizedMembers.length === 0) {
      setIsSaving(false);
      setMessage("请至少选择一个 Agent 成员。");
      return null;
    }
    if (!selectedLeaderId) {
      setIsSaving(false);
      setMessage("请选择 Agent 团队 Leader。");
      return null;
    }

    const teamId = form.id || crypto.randomUUID();
    const response = await fetch("/api/agent-teams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: teamId,
        businessTeamId: form.businessTeamId,
        slug: form.slug || slugify(form.name) || `agent-team-${crypto.randomUUID().slice(0, 8)}`,
        name: form.name,
        description: form.description,
        leaderAgentId: selectedLeaderId,
        workflowType: form.workflowType,
        orchestrationPrompt: form.orchestrationPrompt,
        workflowDefinitionJson: buildWorkflowDefinitionJson(),
        inputSchemaJson: props.team.inputSchemaJson || JSON.stringify({ type: "object" }, null, 2),
        outputSchemaJson: props.team.outputSchemaJson || JSON.stringify({ type: "object" }, null, 2),
        maxConcurrency: Number(form.maxConcurrency || 1),
        timeoutMs: Number(form.timeoutMinutes || 20) * 60_000,
        successRateThreshold: Number(form.successRateThreshold || 90) / 100,
        pricingModelJson: props.team.pricingModelJson || JSON.stringify({ baseUsd: 0, tokenMultiplier: 1 }, null, 2),
        visibility: form.visibility,
        defaultExecutionPolicyId: form.defaultExecutionPolicyId || null,
        members: normalizedMembers,
        shares: normalizedShares,
      }),
    });

    setIsSaving(false);
    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!response.ok || payload.ok === false) {
      setMessage(payload.error ?? "保存 Agent 团队失败。");
      return null;
    }

    setForm((current) => ({ ...current, id: teamId }));
    setMessage("已保存。");
    if (closeAfterSave) props.onSaved?.();
    router.refresh();
    return teamId;
  }

  async function save() {
    await persistTeam(true);
  }

  async function launchCodeReviewSession() {
    setIsLaunching(true);
    const teamId = await persistTeam(false);
    if (!teamId) {
      setIsLaunching(false);
      return;
    }
    try {
      const response = await fetch("/api/agent-teams/code-review-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId }),
      });
      const payload = (await response.json()) as { sessionId?: string; error?: string };
      if (!response.ok || !payload.sessionId) throw new Error(payload.error ?? "创建任务会话失败。");
      router.push(`/interactions/${payload.sessionId}`);
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建任务会话失败。");
    } finally {
      setIsLaunching(false);
    }
  }

  const content = (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <section
          className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4"
          onClick={() => setSelectedMemberId(null)}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <Users className="h-4 w-4" />
                团队编队
              </div>
              <div className="mt-1 text-xs text-[var(--ink-muted)]">点击成员配置单个 Agent；点击空白区域配置团队。</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={(event) => {
                  event.stopPropagation();
                  openAssemblyDialog();
                }}
                disabled={isAssembling || isCreatingAgents}
              >
                <Sparkles className="h-4 w-4" />
                {isAssembling ? "组建中" : "团队组建"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={(event) => {
                  event.stopPropagation();
                  const next = newMemberDraft("");
                  setMembers((current) => [...current, next]);
                  setSelectedMemberId(next.id);
                  if (!leaderMemberId) setLeaderMemberId(next.id);
                }}
              >
                <Plus className="h-4 w-4" />
                添加成员
              </Button>
            </div>
          </div>
          <div
            className="mt-5 grid min-h-[250px] grid-cols-[repeat(auto-fill,minmax(128px,128px))] items-start justify-center gap-2 rounded-xl border border-dashed border-[var(--line-strong)] bg-white/50 p-4"
          >
            {members.length ? members.map((member, index) => {
              const agent = agentDefinitionOptions.find((item) => item.id === member.agentDefinitionId);
              const capability = memberCapability(member);
              const weapon = getAgentCapabilityWeapon(capability).weapon.shortName;
              return (
                <button
                  key={member.id}
                  type="button"
                  className={cn(
                    "grid h-[242px] w-32 grid-rows-[144px_24px_66px] justify-items-center rounded-xl border border-transparent p-0 text-center transition hover:-translate-y-1 hover:border-[var(--line-strong)] hover:bg-white",
                    selectedMemberId === member.id && "border-[var(--accent)] bg-white shadow-sm",
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelectedMemberId(member.id);
                  }}
                >
                  <PixelAgentAvatar
                    config={parsePixelAgentAvatarConfig(agent?.avatarConfigJson, `${agent?.name ?? member.memberRole}-${index}`)}
                    capabilityProfile={capability}
                    size="team"
                    className="mx-auto"
                  />
                  <div className="flex h-6 w-full items-center justify-center truncate text-xs font-semibold text-[var(--ink)]">{agent?.name ?? "未选择 Agent"}</div>
                  <div className="h-[66px] w-full rounded-[8px] bg-[var(--surface-muted)] px-2 py-1 text-left">
                    <div className="text-[10px] font-medium uppercase text-[var(--ink-subtle)]">角色</div>
                    <div
                      className="mt-0.5 overflow-hidden break-words text-[11px] font-medium leading-4 text-[var(--ink)]"
                      style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 2 }}
                    >
                      {member.memberRole}
                    </div>
                    <div className="mt-1 text-[11px] text-[var(--ink-muted)]">武器 · {weapon}</div>
                  </div>
                </button>
              );
            }) : (
              <div className="max-w-sm text-center text-sm text-[var(--ink-muted)]">还没有成员。可以先填写团队目标，再用团队组建从现有 Agent 中自动选人。</div>
            )}
          </div>
        </section>

        <aside className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
            {selectedMember ? <Bot className="h-4 w-4" /> : <Users className="h-4 w-4" />}
            {selectedMember ? "成员配置" : "团队配置"}
          </div>
          <div className="mt-1 text-xs text-[var(--ink-muted)]">
            {selectedMember ? "修改当前成员的 Agent、角色和工作指令。" : "修改团队身份、归属和整体目标。"}
          </div>

          {selectedMember ? (
            <div className="mt-4 space-y-3">
              <FieldGroup label="Agent">
                <Select value={selectedMember.agentDefinitionId} onChange={(event) => updateMember(selectedMember.id, { agentDefinitionId: event.target.value })}>
                  <option value="">请选择 Agent</option>
                  {agentDefinitionOptions.map((agent) => (
                    <option key={agent.id} value={agent.id}>{agent.name}</option>
                  ))}
                </Select>
              </FieldGroup>
              <FieldGroup label="角色">
                <Input value={selectedMember.memberRole} onChange={(event) => updateMember(selectedMember.id, { memberRole: event.target.value })} />
              </FieldGroup>
              <FieldGroup label="工作指令">
                <Textarea value={selectedMember.workInstruction} onChange={(event) => updateMember(selectedMember.id, { workInstruction: event.target.value })} rows={5} />
              </FieldGroup>
              <div className="flex items-center justify-between gap-3">
                <label className="flex h-10 items-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 text-sm">
                  <input checked={leaderMemberId === selectedMember.id} onChange={() => setLeaderMemberId(selectedMember.id)} type="radio" />
                  Leader
                </label>
                <Button
                  size="sm"
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setMembers((current) => current.filter((item) => item.id !== selectedMember.id));
                    setSelectedMemberId(null);
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  移除
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <FieldGroup label="团队名称">
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                      slug: current.id ? current.slug : slugify(event.target.value),
                    }))
                  }
                  placeholder="目标执行小队"
                />
              </FieldGroup>
              <FieldGroup label="业务团队">
                <Select value={form.businessTeamId} onChange={(event) => setForm({ ...form, businessTeamId: event.target.value })}>
                  <option value="">请选择</option>
                  {props.businessTeamOptions.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </Select>
              </FieldGroup>
              <FieldGroup label="目标">
                <Textarea value={form.teamObjective} onChange={(event) => setForm({ ...form, teamObjective: event.target.value })} rows={5} />
              </FieldGroup>
            </div>
          )}
        </aside>
      </div>

      <details className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4" open>
        <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">TEAM.md <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">团队定义与协作原则</span></summary>
        <div className="mt-4 space-y-3">
          <div className="flex justify-end">
            <Button type="button" size="sm" variant="secondary" onClick={optimizeTeam} disabled={isOptimizing}>
              <Sparkles className="h-4 w-4" />
              {isOptimizing ? "优化中" : "AI 优化"}
            </Button>
          </div>
          <Textarea className="min-h-[300px] font-mono text-xs leading-5" value={form.orchestrationPrompt} onChange={(event) => setForm({ ...form, orchestrationPrompt: event.target.value })} />
        </div>
      </details>

      <details className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">基础与运行配置 <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">Slug、可见性、工作流和执行策略</span></summary>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <FieldGroup label="Slug"><Input value={form.slug} onChange={(event) => setForm({ ...form, slug: slugify(event.target.value) })} /></FieldGroup>
          <FieldGroup label="默认执行策略">
            <Select value={form.defaultExecutionPolicyId} onChange={(event) => setForm({ ...form, defaultExecutionPolicyId: event.target.value })}>
              <option value="">不绑定</option>
              {props.executionPolicyOptions.map((policy) => <option key={policy.id} value={policy.id}>{policy.name}</option>)}
            </Select>
          </FieldGroup>
          <FieldGroup label="工作流类型">
            <Select value={form.workflowType} onChange={(event) => setForm({ ...form, workflowType: event.target.value })}>
              <option value="parallel">并行</option>
              <option value="sequential">串行</option>
              <option value="dag">DAG</option>
              <option value="hierarchical">分层</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="可见性">
            <Select value={form.visibility} onChange={(event) => setForm({ ...form, visibility: event.target.value })}>
              <option value="team">团队可见</option>
              <option value="global">全局可见</option>
              <option value="personal">个人可见</option>
              <option value="public">公开</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="团队结构">
            <Select value={form.teamStructure} onChange={(event) => setForm({ ...form, teamStructure: event.target.value })}>
              <option value="leader_worker">Leader / Worker</option>
              <option value="collaborative">协同</option>
              <option value="inspector_publisher">检查 / 发布</option>
              <option value="custom">自定义</option>
            </Select>
          </FieldGroup>
          <FieldGroup label="最大并发"><Input value={form.maxConcurrency} onChange={(event) => setForm({ ...form, maxConcurrency: event.target.value })} type="number" /></FieldGroup>
          <FieldGroup label="超时分钟"><Input value={form.timeoutMinutes} onChange={(event) => setForm({ ...form, timeoutMinutes: event.target.value })} type="number" /></FieldGroup>
          <FieldGroup label="成功率阈值"><Input value={form.successRateThreshold} onChange={(event) => setForm({ ...form, successRateThreshold: event.target.value })} type="number" /></FieldGroup>
          <FieldGroup label="拆分策略"><Input value={form.splitStrategy} onChange={(event) => setForm({ ...form, splitStrategy: event.target.value })} /></FieldGroup>
          <FieldGroup label="说明" className="md:col-span-2 xl:col-span-3">
            <Textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} rows={3} />
          </FieldGroup>
        </div>
      </details>

      <details className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
        <summary className="cursor-pointer text-sm font-semibold text-[var(--ink)]">共享权限 <span className="ml-2 text-xs font-normal text-[var(--ink-muted)]">跨业务团队访问范围</span></summary>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {props.businessTeamOptions.map((team) => (
            <label key={team.id} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm">
              <span>{team.name}</span>
              <Select className="w-32" value={shareMap[team.id] ?? ""} onChange={(event) => setShareMap((current) => ({ ...current, [team.id]: event.target.value }))}>
                <option value="">不共享</option>
                <option value="viewer">查看</option>
                <option value="operator">运行</option>
                <option value="editor">编辑</option>
              </Select>
            </label>
          ))}
        </div>
      </details>

      <Dialog
        open={assemblyDialogOpen}
        onOpenChange={(open) => {
          if (!isAssembling) setAssemblyDialogOpen(open);
        }}
      >
        <DialogContent className="w-[min(94vw,720px)]">
          <DialogHeader>
            <DialogTitle>团队意图发现与组建</DialogTitle>
            <DialogDescription>先明确团队意图，再让默认模型扫描 Agent 能力并生成成员编队。</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <FieldGroup label="团队意图">
              <Textarea
                value={assemblyIntent}
                onChange={(event) => setAssemblyIntent(event.target.value)}
                rows={5}
                disabled={isAssembling}
                placeholder="例如：组建一个可以拆解需求、修改代码、验证结果并输出 PR 说明的研发执行团队。"
              />
            </FieldGroup>

            <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                <Target className="h-4 w-4" />
                初步进度
              </div>
              <div className="mt-3 grid gap-2">
                {assemblyProgress.map((step) => (
                  <div key={step.key} className="flex gap-3 rounded-lg bg-white px-3 py-2">
                    <div className="mt-0.5 h-5 w-5 shrink-0">
                      {step.status === "done" ? (
                        <CheckCircle2 className="h-5 w-5 text-[var(--success)]" />
                      ) : step.status === "running" ? (
                        <Loader2 className="h-5 w-5 animate-spin text-[var(--accent)]" />
                      ) : (
                        <Circle className="h-5 w-5 text-[var(--ink-subtle)]" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--ink)]">{step.label}</div>
                      <div className="mt-1 text-xs leading-5 text-[var(--ink-muted)]">{step.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setAssemblyDialogOpen(false)} disabled={isAssembling}>
                取消
              </Button>
              <Button type="button" variant="primary" onClick={() => void assembleTeam()} disabled={isAssembling}>
                <Sparkles className="h-4 w-4" />
                {isAssembling ? "组建中" : "开始组建"}
              </Button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(pendingAssembly)}
        onOpenChange={(open) => {
          if (!open && !isCreatingAgents) setPendingAssembly(null);
        }}
      >
        <DialogContent className="w-[min(94vw,760px)]">
          <DialogHeader>
            <DialogTitle>确认新增 Agent</DialogTitle>
            <DialogDescription>默认模型认为当前目标需要补齐能力。确认后才会新增 Agent；取消新增时只使用现有成员组建团队。</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {pendingAssembly ? (
              <>
                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                    <Users className="h-4 w-4" />
                    已选现有 Agent
                  </div>
                  <div className="mt-3 grid gap-2">
                    {pendingAssembly.selectedMembers.length ? pendingAssembly.selectedMembers.map((member) => {
                      const agent = agentDefinitionOptions.find((item) => item.id === member.agentDefinitionId);
                      return (
                        <div key={member.agentDefinitionId} className="rounded-lg bg-white px-3 py-2 text-sm">
                          <div className="font-medium text-[var(--ink)]">{agent?.name ?? member.agentDefinitionId}</div>
                          <div className="mt-1 text-xs text-[var(--ink-muted)]">{member.memberRole}{member.isLeader ? " · Leader" : ""}</div>
                          {member.rationale ? <div className="mt-1 text-xs text-[var(--ink-muted)]">{member.rationale}</div> : null}
                        </div>
                      );
                    }) : (
                      <div className="rounded-lg bg-white px-3 py-2 text-sm text-[var(--ink-muted)]">没有找到足够合适的现有 Agent。</div>
                    )}
                  </div>
                </div>

                <div className="rounded-xl border border-[rgba(245,158,11,0.35)] bg-[rgba(245,158,11,0.08)] p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
                    <AlertTriangle className="h-4 w-4 text-[rgb(180,83,9)]" />
                    将新增的 Agent
                  </div>
                  <div className="mt-3 grid gap-2">
                    {pendingAssembly.newAgents.map((agent) => (
                      <div key={agent.tempId} className="rounded-lg bg-white px-3 py-2 text-sm">
                        <div className="font-medium text-[var(--ink)]">{agent.name}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{agent.role} · {agent.memberRole}{agent.isLeader ? " · Leader" : ""}</div>
                        <div className="mt-2 text-xs leading-5 text-[var(--ink-muted)]">{agent.rationale || agent.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {pendingAssembly.notes?.length ? (
                  <div className="rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-xs leading-5 text-[var(--ink-muted)]">
                    {pendingAssembly.notes.join(" ")}
                  </div>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button type="button" variant="ghost" onClick={useExistingAgentsOnly} disabled={isCreatingAgents}>
                    只用现有 Agent
                  </Button>
                  <Button type="button" variant="primary" onClick={confirmAssemblyWithNewAgents} disabled={isCreatingAgents || !form.businessTeamId}>
                    <UserPlus className="h-4 w-4" />
                    {isCreatingAgents ? "新增中" : "确认新增并组建"}
                  </Button>
                </div>
                {!form.businessTeamId ? (
                  <div className="text-xs text-[var(--danger)]">请先选择业务团队，新增 Agent 需要归属团队。</div>
                ) : null}
              </>
            ) : null}
          </DialogBody>
        </DialogContent>
      </Dialog>

      {message ? <div className="rounded-xl bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--ink-muted)]">{message}</div> : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={launchCodeReviewSession} disabled={isSaving || isLaunching}>
          <ClipboardList className="h-4 w-4" />
          {isLaunching ? "创建中" : "生成任务并开启会话"}
        </Button>
        <Button variant="primary" onClick={save} disabled={isSaving || isLaunching}>
          {isSaving ? "保存中" : "保存团队"}
        </Button>
      </div>
    </div>
  );

  if (props.embedded) return content;

  return (
    <Panel>
      <PanelHeader title={props.title} />
      <PanelBody>{content}</PanelBody>
    </Panel>
  );
}
