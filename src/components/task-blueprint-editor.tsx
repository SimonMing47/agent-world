"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useMemo, useState } from "react";
import { ChevronDown, GitBranch, Settings2, SlidersHorizontal, Users, Webhook, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { Select } from "@/components/ui/select";
import {
  TaskWorkflowBlockEditor,
  type WorkflowBlock,
  type WorkflowBlockType,
} from "@/components/task-workflow-block-editor";
import { Textarea } from "@/components/ui/textarea";
import { uiText } from "@/lib/language-pack";
import { cn } from "@/lib/utils";

type AgentTeamOption = {
  id: string;
  name: string;
  workflowType?: string;
  leaderAgentId?: string | null;
  orchestrationPrompt?: string;
  workflowDefinitionJson?: string;
  members?: Array<{
    id: string;
    name: string;
    role: string;
    memberRole: string;
    workInstruction: string;
  }>;
};

type EnvironmentOption = {
  id: string;
  name: string;
  repositoryProvider?: string;
  repositoryName?: string;
  workingDirectory?: string;
  sandboxProfileJson?: string;
};

type TaskBlueprintEditorProps = {
  blueprint: {
    id: string;
    name: string;
    category: string;
    visibility: string;
    ownerBusinessTeamId: string;
    teamId: string;
    environmentId: string | null;
    providerAdapterId: string;
    version: number;
    status: string;
    triggerJson: string;
    inputSchemaJson: string;
    environmentSelectorJson: string;
    agentTeamRunPlanJson: string;
    memoryPolicyJson: string;
    providerPolicyJson: string;
    permissionPolicyJson: string;
    resultSchemaJson: string;
    outputPolicyJson: string;
    dashboardPolicyJson: string;
    executionPolicyJson: string;
    archivePolicyJson: string;
  };
  options: {
    businessTeams: Array<{ id: string; name: string }>;
    agentTeams: AgentTeamOption[];
    environments: EnvironmentOption[];
    providerAdapters: Array<{ id: string; name: string }>;
  };
  embedded?: boolean;
  title?: string;
  onSaved?: () => void;
};

function slugifyTaskKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function normalizeJson(value: string, fallback: string) {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return fallback;
  }
}

function parseRecord(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function parseStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function parseWorkflowDefinition(value?: string) {
  try {
    const parsed = JSON.parse(value ?? "{}") as Record<string, unknown>;
    return {
      teamObjective: String(parsed.teamObjective ?? ""),
      aggregationMethod: String(parsed.aggregationMethod ?? "leader_summary"),
      conflictResolution: String(parsed.conflictResolution ?? "leader_decision"),
      splitStrategy: String(parsed.splitStrategy ?? ""),
    };
  } catch {
    return {
      teamObjective: "",
      aggregationMethod: "leader_summary",
      conflictResolution: "leader_decision",
      splitStrategy: "",
    };
  }
}

function buildExecutionPolicyJson(value: string, blocks: WorkflowBlock[]) {
  const policy = parseRecord(value);
  const toolPolicy =
    policy.toolPolicy && typeof policy.toolPolicy === "object" && !Array.isArray(policy.toolPolicy)
      ? (policy.toolPolicy as Record<string, unknown>)
      : {};
  const allowedTools = Array.from(
    new Set([
      ...parseStringArray(policy.allowedTools),
      ...parseStringArray(policy.tools),
      ...parseStringArray(toolPolicy.allowed),
      ...blocks.map((block) => block.tool).filter(Boolean),
    ]),
  );

  return JSON.stringify(
    {
      ...policy,
      allowedTools,
    },
    null,
    2,
  );
}

function parseRunPlan(value: string) {
  const parsed = parseRecord(value);
  const workers = Array.isArray(parsed.workers)
    ? parsed.workers.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    : [];

  return {
    strategy: typeof parsed.strategy === "string" ? parsed.strategy : "",
    leader: typeof parsed.leader === "string" ? parsed.leader : "",
    workers,
    aggregation:
      parsed.aggregation && typeof parsed.aggregation === "object" && !Array.isArray(parsed.aggregation)
        ? (parsed.aggregation as Record<string, unknown>)
        : {},
    conflictResolution:
      parsed.conflictResolution &&
      typeof parsed.conflictResolution === "object" &&
      !Array.isArray(parsed.conflictResolution)
        ? (parsed.conflictResolution as Record<string, unknown>)
        : {},
    splitStrategy: typeof parsed.splitStrategy === "string" ? parsed.splitStrategy : "",
    objective: typeof parsed.objective === "string" ? parsed.objective : "",
    notes: typeof parsed.notes === "string" ? parsed.notes : "",
    blocks: Array.isArray(parsed.blocks)
      ? parsed.blocks.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
      : [],
  };
}

const workflowBlockTypes = ["agent", "agent_team", "script_hook", "http_hook", "notification"] as const;

function isWorkflowBlockType(value: unknown): value is WorkflowBlockType {
  return workflowBlockTypes.includes(value as WorkflowBlockType);
}

function normalizeBlockId(value: unknown, index: number) {
  const raw = typeof value === "string" && value.trim() ? value : `block_${index + 1}`;
  return raw
    .trim()
    .replace(/[^a-zA-Z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64) || `block_${index + 1}`;
}

function inferBlockTool(type: WorkflowBlockType, value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  if (type === "agent") return "agent.execute";
  if (type === "agent_team") return "agent_team.invoke";
  if (type === "script_hook") return "script.run";
  if (type === "http_hook") return "hook.http";
  return "connector.email";
}

function inferBlockAction(type: WorkflowBlockType, value: unknown) {
  if (typeof value === "string" && value.trim()) return value;
  if (type === "agent_team") return "delegate";
  if (type === "script_hook") return "run_script";
  if (type === "http_hook") return "call_hook";
  if (type === "notification") return "notify";
  return "execute";
}

function parseWorkflowBlocks(value: string, team: AgentTeamOption | null): WorkflowBlock[] {
  const runPlan = parseRunPlan(value);
  if (runPlan.blocks.length > 0) {
    return runPlan.blocks.map((raw, index) => {
      const type = isWorkflowBlockType(raw.type) ? raw.type : "agent";
      return {
        id: normalizeBlockId(raw.id, index),
        type,
        title: typeof raw.title === "string" ? raw.title : uiText("ui.common.workflowBlockTitle", undefined, { index: index + 1 }),
        agentId:
          typeof raw.agentId === "string"
            ? raw.agentId
            : typeof raw.agent === "string"
              ? raw.agent
              : "",
        agentTeamId:
          typeof raw.agentTeamId === "string"
            ? raw.agentTeamId
            : typeof raw.targetAgentTeamId === "string"
              ? raw.targetAgentTeamId
              : "",
        dependsOn: Array.isArray(raw.dependsOn) ? raw.dependsOn.map(String) : [],
        instruction:
          typeof raw.instruction === "string"
            ? raw.instruction
            : typeof raw.task === "string"
              ? raw.task
              : "",
        tool: inferBlockTool(type, raw.tool),
        action: inferBlockAction(type, raw.action),
        script: typeof raw.script === "string" ? raw.script : "",
        url: typeof raw.url === "string" ? raw.url : "",
        method: typeof raw.method === "string" ? raw.method : "POST",
        connectorType: typeof raw.connectorType === "string" ? raw.connectorType : "",
        publisherRef: typeof raw.publisherRef === "string" ? raw.publisherRef : "",
        payloadTemplate:
          typeof raw.payloadTemplate === "string"
            ? raw.payloadTemplate
            : JSON.stringify(raw.payloadTemplate ?? {}, null, 2),
      };
    });
  }

  const members = team?.members ?? [];
  const leader =
    members.find((member) => member.id === team?.leaderAgentId) ??
    members.find((member) => member.memberRole.toLowerCase().includes("leader")) ??
    members[0] ??
    null;
  const blocks: WorkflowBlock[] = [];
  if (leader) {
    blocks.push({
      id: "plan",
      type: "agent",
      title: "ui.generated.cf6da0a93ac",
      agentId: leader.id,
      agentTeamId: "",
      dependsOn: [],
      instruction: runPlan.objective || "ui.generated.c1433d74547",
      tool: "memory.retrieve",
      action: "plan",
      script: "",
      url: "",
      method: "POST",
      connectorType: "",
      publisherRef: "",
      payloadTemplate: "{}",
    });
  }

  const workerBlocks =
    runPlan.workers.length > 0
      ? runPlan.workers
      : members
          .filter((member) => member.id !== leader?.id)
          .map((member) => ({
            agent: member.id,
            task: member.workInstruction || uiText("ui.common.workflowMemberTask", undefined, { role: member.memberRole || member.role }),
          }));
  workerBlocks.forEach((worker, index) => {
    blocks.push({
      id: `worker_${index + 1}`,
      type: "agent",
      title: uiText("ui.common.workflowAssignmentTitle", undefined, { index: index + 1 }),
      agentId: String(worker.agent ?? ""),
      agentTeamId: "",
      dependsOn: leader ? ["plan"] : [],
      instruction: String(worker.task ?? ""),
      tool: typeof worker.tool === "string" ? worker.tool : "agent.execute",
      action: typeof worker.action === "string" ? worker.action : "execute",
      script: "",
      url: "",
      method: "POST",
      connectorType: "",
      publisherRef: "",
      payloadTemplate: "{}",
    });
  });

  if (leader) {
    blocks.push({
      id: "publish",
      type: "notification",
      title: "ui.generated.c6d055fd14e",
      agentId: leader.id,
      agentTeamId: "",
      dependsOn: workerBlocks.length ? workerBlocks.map((_, index) => `worker_${index + 1}`) : ["plan"],
      instruction: uiText("ui.common.workflowAggregationInstruction"),
      tool: "finding.aggregate",
      action: "publish",
      script: "",
      url: "",
      method: "POST",
      connectorType: "dashboard",
      publisherRef: "dashboard",
      payloadTemplate: "{}",
    });
  }

  return blocks;
}

function parseEnvironmentSelector(value: string) {
  const parsed = parseRecord(value);
  return {
    type: typeof parsed.type === "string" ? parsed.type : "repository_workspace",
    repoBinding: typeof parsed.repoBinding === "string" ? parsed.repoBinding : "",
    checkoutMode: typeof parsed.checkoutMode === "string" ? parsed.checkoutMode : "full_clone",
    executionPath: typeof parsed.executionPath === "string" ? parsed.executionPath : "",
    sandboxMode: typeof parsed.sandboxMode === "string" ? parsed.sandboxMode : "inherit",
    sandboxRef: typeof parsed.sandboxRef === "string" ? parsed.sandboxRef : "",
    extraJson: JSON.stringify(
      Object.fromEntries(
        Object.entries(parsed).filter(
          ([key]) =>
            ![
              "type",
              "repoBinding",
              "checkoutMode",
              "executionPath",
              "sandboxMode",
              "sandboxRef",
              "environmentId",
            ].includes(key),
        ),
      ),
      null,
      2,
    ),
  };
}

function buildRunPlanJson(args: {
  team: AgentTeamOption | null;
  blueprintName: string;
  taskObjective: string;
  existingRunPlanJson: string;
  blocks: WorkflowBlock[];
  strategy: string;
}) {
  const existing = parseRunPlan(args.existingRunPlanJson);
  const team = args.team;
  if (!team) {
    return normalizeJson(args.existingRunPlanJson, "{}");
  }

  const workflow = parseWorkflowDefinition(team.workflowDefinitionJson);
  const members = team.members ?? [];
  const leader =
    members.find((member) => member.id === team.leaderAgentId) ??
    members.find((member) => member.memberRole.toLowerCase().includes("leader")) ??
    members[0] ??
    null;
  const blocks = args.blocks.map((block, index) => ({
    ...block,
    id: normalizeBlockId(block.id, index),
    dependsOn: block.dependsOn.filter(Boolean),
    agentId: block.agentId,
  }));
  const workers = blocks
    .filter((block) => block.id !== "plan")
    .map((block) => ({
      agent: block.agentId,
      task: block.instruction.trim() || block.title || block.id,
      action: block.action,
      tool: block.tool,
      blockId: block.id,
      blockType: block.type,
      title: block.title,
      targetAgentTeamId: block.type === "agent_team" ? block.agentTeamId || undefined : undefined,
      connectorType: block.type === "notification" ? block.connectorType || undefined : undefined,
      publisherRef: block.publisherRef || undefined,
    }));
  const terminalBlocks = blocks
    .map((block) => block.id)
    .filter((blockId) => !blocks.some((block) => block.dependsOn.includes(blockId)));

  return JSON.stringify(
    {
      strategy: args.strategy || existing.strategy || team.workflowType || "block_graph",
      leader: leader?.id ?? existing.leader ?? "",
      blocks: blocks.map((block) => ({
        id: block.id,
        type: block.type,
        title: block.title,
        agentId: block.agentId || undefined,
        agentTeamId: block.agentTeamId || undefined,
        dependsOn: block.dependsOn,
        instruction: block.instruction,
        action: block.action,
        tool: block.tool,
        script: block.script || undefined,
        url: block.url || undefined,
        method: block.method || undefined,
        connectorType: block.connectorType || undefined,
        publisherRef: block.publisherRef || undefined,
        payloadTemplate: block.payloadTemplate || undefined,
      })),
      workers,
      aggregation: {
	        agent:
	          typeof existing.aggregation.agent === "string" && existing.aggregation.agent
	            ? existing.aggregation.agent
	            : leader?.id ?? "",
        method:
          typeof existing.aggregation.method === "string" && existing.aggregation.method
            ? existing.aggregation.method
            : workflow.aggregationMethod || "block_graph_publish",
      },
      conflictResolution: {
        method:
          typeof existing.conflictResolution.method === "string" && existing.conflictResolution.method
            ? existing.conflictResolution.method
            : workflow.conflictResolution,
      },
      splitStrategy: existing.splitStrategy || workflow.splitStrategy,
      objective: args.taskObjective.trim() || existing.objective || workflow.teamObjective || args.blueprintName,
      notes: existing.notes || team.orchestrationPrompt || "",
      graph: {
        nodes: blocks.map((block) => block.id),
        edges: blocks.flatMap((block) => block.dependsOn.map((dependency) => [dependency, block.id])),
        terminalBlocks,
      },
    },
    null,
    2,
  );
}

function buildEnvironmentSelectorJson(args: {
  environment: EnvironmentOption | null;
  environmentSelectorJson: string;
  repoBinding: string;
  checkoutMode: string;
  executionPath: string;
  sandboxMode: string;
  sandboxRef: string;
  environmentSelectorExtraJson: string;
}) {
  const base = parseRecord(args.environmentSelectorJson);
  const extra = parseRecord(args.environmentSelectorExtraJson);

  return JSON.stringify(
    {
      ...base,
      ...extra,
      type: "repository_workspace",
      environmentId: args.environment?.id ?? null,
      repoBinding: args.repoBinding.trim() || undefined,
      checkoutMode: args.checkoutMode,
      executionPath:
        args.executionPath.trim() || args.environment?.workingDirectory || ".",
      sandboxMode: args.sandboxMode,
      sandboxRef: args.sandboxRef.trim() || undefined,
    },
    null,
    2,
  );
}

function EditorSection({
  title,
  description,
  icon,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  icon: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className="group rounded-lg border border-[var(--line)] bg-[rgba(255,255,255,0.58)]"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
        <span className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--line)] bg-white text-[var(--ink)]">
            {icon}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-[var(--ink)]">{title}</span>
            {description ? (
              <span className="mt-0.5 block text-xs leading-5 text-[var(--ink-muted)]">{description}</span>
            ) : null}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-[var(--ink-muted)] transition-transform",
            open ? "rotate-180" : "rotate-0",
          )}
        />
      </summary>
      <div className="border-t border-[var(--line)] px-4 py-4">{children}</div>
    </details>
  );
}

export function TaskBlueprintEditor({
  blueprint,
  options,
  embedded = false,
  title = uiText("ui.common.workflowEditorTitle"),
  onSaved,
}: TaskBlueprintEditorProps) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const trigger = parseRecord(blueprint.triggerJson);
  const selector = parseEnvironmentSelector(blueprint.environmentSelectorJson);
  const runPlan = parseRunPlan(blueprint.agentTeamRunPlanJson);
  const initialSelectedTeam = options.agentTeams.find((team) => team.id === blueprint.teamId) ?? null;
  const [form, setForm] = useState({
    id: blueprint.id,
    name: blueprint.name,
    category: blueprint.category,
    visibility: blueprint.visibility,
    ownerBusinessTeamId: blueprint.ownerBusinessTeamId,
    teamId: blueprint.teamId,
    environmentId: blueprint.environmentId ?? "",
    providerAdapterId: blueprint.providerAdapterId,
    version: String(blueprint.version),
    status: blueprint.status,
    triggerType: typeof trigger.type === "string" ? trigger.type : "manual",
    triggerConnector: typeof trigger.connector === "string" ? trigger.connector : "",
    triggerEvent: typeof trigger.event === "string" ? trigger.event : "",
    triggerExpression: typeof trigger.expression === "string" ? trigger.expression : "",
    triggerWebhookPathKey:
      typeof trigger.webhookPathKey === "string" ? trigger.webhookPathKey : "",
    triggerIdempotencyKey:
      typeof trigger.idempotencyKey === "string" ? trigger.idempotencyKey : "",
    triggerSecretRef:
      typeof trigger.webhookSecretRef === "string"
        ? trigger.webhookSecretRef
        : typeof trigger.secretRef === "string"
          ? trigger.secretRef
          : "",
    triggerExtraJson: JSON.stringify(
      Object.fromEntries(
        Object.entries(trigger).filter(
          ([key]) =>
            ![
              "type",
              "connector",
              "event",
              "expression",
              "webhookPathKey",
              "endpoint",
              "idempotencyKey",
              "secretRef",
              "webhookSecretRef",
            ].includes(key),
        ),
      ),
      null,
      2,
    ),
    repoBinding: selector.repoBinding,
    checkoutMode: selector.checkoutMode,
    executionPath: selector.executionPath,
    sandboxMode: selector.sandboxMode,
    sandboxRef: selector.sandboxRef,
    environmentSelectorExtraJson: selector.extraJson,
    taskObjective: runPlan.objective,
    orchestrationStrategy: runPlan.strategy || initialSelectedTeam?.workflowType || "block_graph",
    blocks: parseWorkflowBlocks(blueprint.agentTeamRunPlanJson, initialSelectedTeam),
    inputSchemaJson: normalizeJson(
      blueprint.inputSchemaJson,
      JSON.stringify({ type: "object", properties: {}, required: [] }, null, 2),
    ),
    resultSchemaJson: normalizeJson(
      blueprint.resultSchemaJson,
      JSON.stringify({ type: "object", properties: {} }, null, 2),
    ),
    memoryPolicyJson: normalizeJson(
      blueprint.memoryPolicyJson,
      JSON.stringify({ requiredSpaces: [], archiveOutputTo: [] }, null, 2),
    ),
    providerPolicyJson: normalizeJson(blueprint.providerPolicyJson, "{}"),
    permissionPolicyJson: normalizeJson(
      blueprint.permissionPolicyJson,
      JSON.stringify({ defaultMode: "ask", rules: [] }, null, 2),
    ),
    outputPolicyJson: normalizeJson(
      blueprint.outputPolicyJson,
      JSON.stringify({ publishers: [] }, null, 2),
    ),
    dashboardPolicyJson: normalizeJson(blueprint.dashboardPolicyJson, "{}"),
    executionPolicyJson: normalizeJson(blueprint.executionPolicyJson, "{}"),
    archivePolicyJson: normalizeJson(blueprint.archivePolicyJson, "{}"),
  });

  const selectedTeam = useMemo(
    () => options.agentTeams.find((team) => team.id === form.teamId) ?? null,
    [options.agentTeams, form.teamId],
  );
  const selectedEnvironment = useMemo(
    () => options.environments.find((environment) => environment.id === form.environmentId) ?? null,
    [options.environments, form.environmentId],
  );

  async function save() {
    setIsSaving(true);
    setMessage(null);

    if (!form.name.trim()) {
      setIsSaving(false);
      setMessage("ui.generated.c9f0353fb87");
      return;
    }

    if (!form.ownerBusinessTeamId.trim()) {
      setIsSaving(false);
      setMessage("ui.generated.ca5569f6d6d");
      return;
    }

    if (!form.teamId.trim()) {
      setIsSaving(false);
      setMessage("ui.generated.c80262586b1");
      return;
    }

	    const providerAdapterId = form.providerAdapterId.trim();

    if (form.triggerType === "cron" && !form.triggerExpression.trim()) {
      setIsSaving(false);
      setMessage("ui.generated.c9269fbd4c7");
      return;
    }

    if (form.triggerType === "webhook" && !form.triggerWebhookPathKey.trim()) {
      setIsSaving(false);
      setMessage("ui.generated.c1a99f7840e");
      return;
    }

    if (form.blocks.length === 0) {
      setIsSaving(false);
      setMessage("ui.generated.cc79d90e253");
      return;
    }

    const invalidBlock = form.blocks.find((block) => {
      if (!block.id.trim() || !block.title.trim()) return true;
      if (block.type === "agent" && !block.agentId.trim()) return true;
      if (block.type === "agent_team" && !block.agentTeamId.trim()) return true;
      if (block.type === "script_hook" && !block.script.trim()) return true;
      if (block.type === "http_hook" && !block.url.trim()) return true;
      if (block.type === "notification" && !block.connectorType.trim()) return true;
      return false;
    });
    if (invalidBlock) {
      setIsSaving(false);
      setMessage(uiText("ui.common.workflowBlockInvalid", undefined, {
        title: invalidBlock.title || invalidBlock.id,
      }));
      return;
    }

    const jsonFields = [
      form.triggerExtraJson,
      form.environmentSelectorExtraJson,
      form.inputSchemaJson,
      form.resultSchemaJson,
      form.memoryPolicyJson,
      form.providerPolicyJson,
      form.permissionPolicyJson,
      form.outputPolicyJson,
      form.dashboardPolicyJson,
      form.executionPolicyJson,
      form.archivePolicyJson,
    ];

    try {
      jsonFields.forEach((value) => {
        JSON.parse(value);
      });
      form.blocks.forEach((block) => {
        if ((block.type === "http_hook" || block.type === "notification") && block.payloadTemplate.trim()) {
          JSON.parse(block.payloadTemplate);
        }
      });
    } catch {
      setIsSaving(false);
      setMessage("ui.generated.ce0ca545e60");
      return;
    }

    const blueprintId =
      form.id.trim() ||
      slugifyTaskKey(form.name) ||
      `task_${crypto.randomUUID().replace(/-/g, "_").slice(0, 12)}`;

    const triggerJson = JSON.stringify(
      {
        ...parseRecord(form.triggerExtraJson),
        type: form.triggerType,
        connector: form.triggerConnector.trim() || undefined,
        event: form.triggerEvent.trim() || undefined,
        expression: form.triggerExpression.trim() || undefined,
        webhookPathKey: form.triggerWebhookPathKey.trim() || undefined,
        endpoint:
          form.triggerType === "webhook" && form.triggerWebhookPathKey.trim()
            ? `/api/webhooks/${form.triggerWebhookPathKey.trim()}`
            : undefined,
        idempotencyKey: form.triggerIdempotencyKey.trim() || undefined,
        webhookSecretRef:
          form.triggerType === "webhook" && form.triggerSecretRef.trim()
            ? form.triggerSecretRef.trim()
            : undefined,
      },
      null,
      2,
    );

    const runPlanJson = buildRunPlanJson({
      team: selectedTeam,
      blueprintName: form.name,
      taskObjective: form.taskObjective,
      existingRunPlanJson: blueprint.agentTeamRunPlanJson,
      blocks: form.blocks,
      strategy: form.orchestrationStrategy,
    });
    const environmentSelectorJson = buildEnvironmentSelectorJson({
      environment: selectedEnvironment,
      environmentSelectorJson: blueprint.environmentSelectorJson,
      repoBinding: form.repoBinding,
      checkoutMode: form.checkoutMode,
      executionPath: form.executionPath,
      sandboxMode: form.sandboxMode,
      sandboxRef: form.sandboxRef,
      environmentSelectorExtraJson: form.environmentSelectorExtraJson,
    });
    const executionPolicyJson = buildExecutionPolicyJson(form.executionPolicyJson, form.blocks);

    const payload = {
      id: blueprintId,
      name: form.name,
      category: form.category.trim(),
      visibility: form.visibility,
      ownerBusinessTeamId: form.ownerBusinessTeamId,
      teamId: form.teamId,
      environmentId: form.environmentId || null,
      providerAdapterId,
      version: Number(form.version) || 1,
      status: form.status,
      triggerJson,
      inputSchemaJson: form.inputSchemaJson,
      environmentSelectorJson,
      agentTeamRunPlanJson: runPlanJson,
      memoryPolicyJson: form.memoryPolicyJson,
      providerPolicyJson: form.providerPolicyJson,
      permissionPolicyJson: form.permissionPolicyJson,
      resultSchemaJson: form.resultSchemaJson,
      outputPolicyJson: form.outputPolicyJson,
      dashboardPolicyJson: form.dashboardPolicyJson,
      executionPolicyJson,
      archivePolicyJson: form.archivePolicyJson,
    };

    const url = blueprint.id ? `/api/task-blueprints/${blueprint.id}` : "/api/task-blueprints";
    const method = blueprint.id ? "PATCH" : "POST";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setIsSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setMessage(body.error ?? "ui.generated.c052ebc86b3");
      return;
    }

    setMessage("ui.generated.ca17f0ff2ba");
    onSaved?.();
    router.refresh();
  }

  const isWebhookTrigger = form.triggerType === "webhook";
  const isCronTrigger = form.triggerType === "cron";
  const webhookEndpoint = form.triggerWebhookPathKey.trim()
    ? `/api/webhooks/${form.triggerWebhookPathKey.trim()}`
    : "保存后生成";

  const content = (
    <div className="space-y-4">
      <EditorSection
        defaultOpen
        title="关键配置"
        description="优先确定触发来源、Agent 团队和任务目标。"
        icon={<Webhook className="h-4 w-4" />}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="任务名称">
            <Input
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  name: event.target.value,
                  id: current.id ? current.id : slugifyTaskKey(event.target.value),
                }))
              }
              placeholder="例如：合并请求安全巡检"
            />
          </FieldGroup>
          <FieldGroup label="运行状态">
            <Select
              value={form.status}
              onChange={(event) => setForm({ ...form, status: event.target.value })}
            >
              {[
                ["active", "active"],
                ["draft", "draft"],
                ["paused", "paused"],
                ["archived", "archived"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="业务团队">
            <Select
              value={form.ownerBusinessTeamId}
              onChange={(event) => setForm({ ...form, ownerBusinessTeamId: event.target.value })}
            >
              <option value="">请选择业务团队</option>
              {options.businessTeams.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="Agent 团队">
            <Select
              value={form.teamId}
              onChange={(event) => {
                const nextTeamId = event.target.value;
                const nextTeam = options.agentTeams.find((team) => team.id === nextTeamId) ?? null;
                setForm({
                  ...form,
                  teamId: nextTeamId,
                  orchestrationStrategy: nextTeam?.workflowType || form.orchestrationStrategy || "block_graph",
                  blocks: parseWorkflowBlocks(blueprint.agentTeamRunPlanJson, nextTeam),
                });
              }}
            >
              <option value="">请选择 Agent 团队</option>
              {options.agentTeams.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="触发方式">
            <Select
              value={form.triggerType}
              onChange={(event) => setForm({ ...form, triggerType: event.target.value })}
            >
              {[
                ["webhook", "Webhook"],
                ["manual", "手动"],
                ["cron", "Cron"],
                ["access_grant", "授权调用"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FieldGroup>
          {isWebhookTrigger ? (
            <FieldGroup label="Webhook Path">
              <Input
                value={form.triggerWebhookPathKey}
                onChange={(event) => setForm({ ...form, triggerWebhookPathKey: event.target.value })}
                placeholder="merge-request-review"
              />
            </FieldGroup>
          ) : null}
          {isWebhookTrigger ? (
            <FieldGroup label="事件名称">
              <Input
                value={form.triggerEvent}
                onChange={(event) => setForm({ ...form, triggerEvent: event.target.value })}
                placeholder="merge_request.updated"
              />
            </FieldGroup>
          ) : null}
          {isCronTrigger ? (
            <FieldGroup label="Cron 表达式">
              <Input
                value={form.triggerExpression}
                onChange={(event) => setForm({ ...form, triggerExpression: event.target.value })}
                placeholder="0 2 * * *"
              />
            </FieldGroup>
          ) : null}
          <FieldGroup label="任务目标" className="md:col-span-2">
            <Textarea
              value={form.taskObjective}
              onChange={(event) => setForm({ ...form, taskObjective: event.target.value })}
              placeholder="说明收到 webhook 后团队要完成什么工作。"
            />
          </FieldGroup>
          {isWebhookTrigger ? (
            <div className="md:col-span-2 rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] px-3 py-2 font-mono text-xs text-[var(--ink-muted)]">
              {webhookEndpoint}
            </div>
          ) : null}
        </div>
      </EditorSection>

      <EditorSection
        defaultOpen
        title="Agent 协作流程"
        description="配置团队拆分、委派、依赖和汇总节点。"
        icon={<Workflow className="h-4 w-4" />}
      >
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-semibold text-[var(--ink)]">编排策略</div>
              <div className="mt-1 text-xs text-[var(--ink-muted)]">保存时会写入 Agent Team Run Plan。</div>
            </div>
            <div className="w-full sm:w-60">
              <Select
                value={form.orchestrationStrategy}
                onChange={(event) => setForm({ ...form, orchestrationStrategy: event.target.value })}
                aria-label="编排策略"
              >
                {[
                  ["block_graph", "block_graph"],
                  ["leader_worker_parallel", "leader_worker_parallel"],
                  ["parallel", "parallel"],
                  ["sequential", "sequential"],
                  ["dag", "dag"],
                ].map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <TaskWorkflowBlockEditor
            blocks={form.blocks}
            onChange={(blocks) => setForm({ ...form, blocks })}
            agents={selectedTeam?.members ?? []}
            agentTeams={options.agentTeams.map((team) => ({ id: team.id, name: team.name }))}
          />
        </div>
      </EditorSection>

      <EditorSection
        title="触发高级选项"
        description="Webhook parser、密钥、幂等键和额外触发 JSON。"
        icon={<SlidersHorizontal className="h-4 w-4" />}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="Parser / Connector">
            <Input
              value={form.triggerConnector}
              onChange={(event) => setForm({ ...form, triggerConnector: event.target.value })}
              placeholder="official.codehub.webhook.merge_request"
            />
          </FieldGroup>
          <FieldGroup label="幂等键模板">
            <Input
              value={form.triggerIdempotencyKey}
              onChange={(event) => setForm({ ...form, triggerIdempotencyKey: event.target.value })}
              placeholder="${task_blueprint_id}:${delivery_id}:${diff_ref}"
            />
          </FieldGroup>
          <FieldGroup label="Webhook Secret Ref">
            <Input
              value={form.triggerSecretRef}
              onChange={(event) => setForm({ ...form, triggerSecretRef: event.target.value })}
              placeholder="env:CODE_PLATFORM_WEBHOOK_SECRET"
            />
          </FieldGroup>
          {!isWebhookTrigger ? (
            <FieldGroup label="Webhook Path">
              <Input
                value={form.triggerWebhookPathKey}
                onChange={(event) => setForm({ ...form, triggerWebhookPathKey: event.target.value })}
                placeholder="merge-request-review"
              />
            </FieldGroup>
          ) : null}
          {!isCronTrigger ? (
            <FieldGroup label="Cron 表达式">
              <Input
                value={form.triggerExpression}
                onChange={(event) => setForm({ ...form, triggerExpression: event.target.value })}
                placeholder="0 2 * * *"
              />
            </FieldGroup>
          ) : null}
          <FieldGroup label="触发额外 JSON" className="md:col-span-2">
            <Textarea
              className="min-h-28"
              value={form.triggerExtraJson}
              onChange={(event) => setForm({ ...form, triggerExtraJson: event.target.value })}
              placeholder='{"source":"code-platform"}'
            />
          </FieldGroup>
        </div>
      </EditorSection>

      <EditorSection
        title="环境与上下文"
        description="仓库、工作目录、沙箱和环境选择。"
        icon={<GitBranch className="h-4 w-4" />}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="执行环境">
            <Select
              value={form.environmentId}
              onChange={(event) => setForm({ ...form, environmentId: event.target.value })}
            >
              <option value="">不绑定环境</option>
              {options.environments.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="仓库绑定">
            <Input
              value={form.repoBinding}
              onChange={(event) => setForm({ ...form, repoBinding: event.target.value })}
              placeholder="${repo_id}"
            />
          </FieldGroup>
          <FieldGroup label="Checkout 模式">
            <Select
              value={form.checkoutMode}
              onChange={(event) => setForm({ ...form, checkoutMode: event.target.value })}
            >
              {[
                ["full_clone", "full_clone"],
                ["diff_context", "diff_context"],
                ["shallow_clone", "shallow_clone"],
                ["workspace_only", "workspace_only"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="执行路径">
            <Input
              value={form.executionPath}
              onChange={(event) => setForm({ ...form, executionPath: event.target.value })}
              placeholder={selectedEnvironment?.workingDirectory ?? "."}
            />
          </FieldGroup>
          <FieldGroup label="沙箱模式">
            <Select
              value={form.sandboxMode}
              onChange={(event) => setForm({ ...form, sandboxMode: event.target.value })}
            >
              {[
                ["inherit", "inherit"],
                ["process", "process"],
                ["workspace", "workspace"],
                ["future", "future"],
              ].map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="沙箱引用">
            <Input
              value={form.sandboxRef}
              onChange={(event) => setForm({ ...form, sandboxRef: event.target.value })}
              placeholder="sandbox:security-inspection"
            />
          </FieldGroup>
          <FieldGroup label="环境额外 JSON" className="md:col-span-2">
            <Textarea
              className="min-h-28"
              value={form.environmentSelectorExtraJson}
              onChange={(event) => setForm({ ...form, environmentSelectorExtraJson: event.target.value })}
              placeholder='{"templateId":"workspace-template"}'
            />
          </FieldGroup>
        </div>
      </EditorSection>

      <EditorSection
        title="数据契约"
        description="输入和结果 Schema。"
        icon={<Settings2 className="h-4 w-4" />}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="输入 Schema" className="md:col-span-2">
            <Textarea
              className="min-h-32"
              value={form.inputSchemaJson}
              onChange={(event) => setForm({ ...form, inputSchemaJson: event.target.value })}
              placeholder='{"type":"object","properties":{}}'
            />
          </FieldGroup>
          <FieldGroup label="结果 Schema" className="md:col-span-2">
            <Textarea
              className="min-h-32"
              value={form.resultSchemaJson}
              onChange={(event) => setForm({ ...form, resultSchemaJson: event.target.value })}
              placeholder='{"type":"object","properties":{}}'
            />
          </FieldGroup>
        </div>
      </EditorSection>

      <EditorSection
        title="任务身份与策略"
        description="分类、可见性、策略 JSON、输出和归档。"
        icon={<Users className="h-4 w-4" />}
      >
        <div className="grid gap-3 md:grid-cols-2">
          <FieldGroup label="任务 ID">
            <Input
              value={form.id}
              onChange={(event) => setForm({ ...form, id: slugifyTaskKey(event.target.value) })}
              placeholder="保存时自动生成"
              disabled={Boolean(blueprint.id)}
            />
          </FieldGroup>
          <FieldGroup label="分类">
            <Input
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              placeholder="inspection"
            />
          </FieldGroup>
          <FieldGroup label="可见性">
            <Select
              value={form.visibility}
              onChange={(event) => setForm({ ...form, visibility: event.target.value })}
            >
              {["team", "global", "private"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </Select>
          </FieldGroup>
          <FieldGroup label="版本">
            <Input
              value={form.version}
              onChange={(event) => setForm({ ...form, version: event.target.value })}
              placeholder="1"
            />
          </FieldGroup>
          <FieldGroup label="记忆策略">
            <Textarea
              className="min-h-28"
              value={form.memoryPolicyJson}
              onChange={(event) => setForm({ ...form, memoryPolicyJson: event.target.value })}
            />
          </FieldGroup>
          <FieldGroup label="权限策略">
            <Textarea
              className="min-h-28"
              value={form.permissionPolicyJson}
              onChange={(event) => setForm({ ...form, permissionPolicyJson: event.target.value })}
            />
          </FieldGroup>
          <FieldGroup label="输出策略">
            <Textarea
              className="min-h-28"
              value={form.outputPolicyJson}
              onChange={(event) => setForm({ ...form, outputPolicyJson: event.target.value })}
            />
          </FieldGroup>
          <FieldGroup label="执行策略">
            <Textarea
              className="min-h-28"
              value={form.executionPolicyJson}
              onChange={(event) => setForm({ ...form, executionPolicyJson: event.target.value })}
            />
          </FieldGroup>
          <FieldGroup label="Provider 策略">
            <Textarea
              className="min-h-28"
              value={form.providerPolicyJson}
              onChange={(event) => setForm({ ...form, providerPolicyJson: event.target.value })}
            />
          </FieldGroup>
          <FieldGroup label="看板策略">
            <Textarea
              className="min-h-28"
              value={form.dashboardPolicyJson}
              onChange={(event) => setForm({ ...form, dashboardPolicyJson: event.target.value })}
            />
          </FieldGroup>
          <FieldGroup label="归档策略" className="md:col-span-2">
            <Textarea
              className="min-h-28"
              value={form.archivePolicyJson}
              onChange={(event) => setForm({ ...form, archivePolicyJson: event.target.value })}
            />
          </FieldGroup>
        </div>
      </EditorSection>

      <div className="flex items-center justify-between gap-3 pt-1">
        <Button type="button" onClick={save} disabled={isSaving}>
          {isSaving ? "ui.generated.ca032e8fdda" : blueprint.id ? "保存任务" : "新增任务"}
        </Button>
        {message ? <div className="text-xs text-[var(--ink-muted)]">{message}</div> : null}
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <Panel>
      <PanelHeader
        eyebrow="ui.generated.c86362a82bf"
        title={title}
        description="ui.generated.c70f362ad5b"
      />
      <PanelBody>{content}</PanelBody>
    </Panel>
  );
}
