"use client";

import { type ComponentProps, type ReactNode } from "react";
import { CalendarClock, GitPullRequestArrow, ShieldAlert, ShieldCheck } from "lucide-react";
import { TaskBlueprintEditor } from "@/components/task-blueprint-editor";
import { useLanguageText } from "@/components/language-pack-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";

type EditorProps = ComponentProps<typeof TaskBlueprintEditor>;
type TaskBlueprintEditorOptions = EditorProps["options"];
type TaskBlueprintDraft = EditorProps["blueprint"];
type AgentTeamOption = TaskBlueprintEditorOptions["agentTeams"][number];

type Props = {
  options: TaskBlueprintEditorOptions;
  selectedBusinessTeamId?: string;
};

function json(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function taskId(base: string, teamId: string) {
  const suffix = teamId
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return [base, suffix].filter(Boolean).join("_");
}

function teamBusinessTeamId(team: AgentTeamOption) {
  return (team as AgentTeamOption & { businessTeamId?: string }).businessTeamId ?? "";
}

function selectBusinessTeam(options: TaskBlueprintEditorOptions, selectedBusinessTeamId?: string) {
  return (
    options.businessTeams.find((team) => team.id === selectedBusinessTeamId) ??
    options.businessTeams[0] ??
    null
  );
}

function selectAgentTeam(options: TaskBlueprintEditorOptions, businessTeamId: string) {
  return (
    options.agentTeams.find((team) => teamBusinessTeamId(team) === businessTeamId) ??
    options.agentTeams[0] ??
    null
  );
}

function selectLeader(team: AgentTeamOption | null) {
  const members = team?.members ?? [];
  return (
    members.find((member) => member.id === team?.leaderAgentId) ??
    members.find((member) => member.memberRole.toLowerCase().includes("leader")) ??
    members[0] ??
    null
  );
}

function selectEnvironment(options: TaskBlueprintEditorOptions, businessTeamId: string) {
  return (
    options.environments.find((environment) => environment.businessTeamId === businessTeamId) ??
    options.environments[0] ??
    null
  );
}

function selectCodebase(options: TaskBlueprintEditorOptions, businessTeamId: string) {
  return (
    options.codebases?.find((codebase) => codebase.businessTeamId === businessTeamId) ??
    options.codebases?.[0] ??
    null
  );
}

function providerAdapterId(options: TaskBlueprintEditorOptions) {
  return options.providerAdapters.some((adapter) => adapter.id === "builtin-agent-runtime")
    ? "builtin-agent-runtime"
    : "";
}

function baseBlueprint(args: {
  id: string;
  name: string;
  category: string;
  businessTeamId: string;
  agentTeamId: string;
  environmentId?: string | null;
  providerAdapterId: string;
}): TaskBlueprintDraft {
  return {
    id: args.id,
    name: args.name,
    category: args.category,
    visibility: "team",
    ownerBusinessTeamId: args.businessTeamId,
    teamId: args.agentTeamId,
    environmentId: args.environmentId ?? null,
    providerAdapterId: args.providerAdapterId,
    version: 1,
    status: "active",
    triggerJson: json({ type: "manual" }),
    inputSchemaJson: json({ type: "object", properties: {}, required: [] }),
    environmentSelectorJson: json({ type: "repository_workspace" }),
    agentTeamRunPlanJson: "{}",
    memoryPolicyJson: json({ requiredSpaces: ["codebase", "skill"], archiveOutputTo: ["finding"] }),
    providerPolicyJson: "{}",
    permissionPolicyJson: json({
      defaultMode: "ask",
      rules: [
        { effect: "allow", resource: "repo.read", scope: "*" },
        { effect: "allow", resource: "repo.issue.comment", scope: "*" },
        { effect: "allow", resource: "secret.use", scope: "*" },
        { effect: "allow", resource: "tool.finding.create", scope: "task_run" },
      ],
    }),
    resultSchemaJson: json({
      type: "object",
      properties: {
        findings: { type: "array" },
        publicationResults: { type: "array" },
      },
    }),
    outputPolicyJson: json({
      publishers: [{ type: "dashboard" }, { type: "artifact_archive" }],
      findingFeedback: { enabled: true, baseUrl: "" },
    }),
    dashboardPolicyJson: json({ board: "software_delivery", findingCategories: ["code_review", "cleancode"] }),
    executionPolicyJson: json({ allowedTools: ["plugin.tool", "memory.retrieve", "connector.email"] }),
    archivePolicyJson: json({ retentionDays: 90, archiveFindings: true }),
  };
}

function buildMergeRequestReviewBlueprint(args: {
  text: ReturnType<typeof useLanguageText>;
  options: TaskBlueprintEditorOptions;
  businessTeamId: string;
  agentTeam: AgentTeamOption;
  leaderAgentId: string;
  codebaseName?: string;
}) {
  const blueprint = baseBlueprint({
    id: taskId("task_code_shield_mr_review", args.businessTeamId),
    name: args.text("softwareTeam.workflowPresets.mrReview.name"),
    category: "software_delivery",
    businessTeamId: args.businessTeamId,
    agentTeamId: args.agentTeam.id,
    providerAdapterId: providerAdapterId(args.options),
  });

  return {
    ...blueprint,
    triggerJson: json({
      type: "webhook",
      connector: "official.gitea.webhook.pull_request",
      webhookParserRef: "official.gitea.webhook.pull_request",
      event: "pull_request",
      webhookPathKey: "code-shield-mr-review",
      idempotencyKey: "${task_blueprint_id}:${plugin_idempotency_key}",
      webhookSecretRef: "",
    }),
    inputSchemaJson: json({
      type: "object",
      properties: {
        repo_id: { type: "string" },
        repo_url: { type: "string" },
        pull_request_index: { type: "string" },
        mr_id: { type: "string" },
        diff_ref: { type: "string" },
        changed_files: {
          type: "array",
          items: {
            type: "object",
            properties: {
              filename: { type: "string" },
              content: { type: "string" },
              patch: { type: "string" },
            },
          },
        },
        author: { type: "string" },
      },
      required: ["repo_id", "pull_request_index"],
    }),
    environmentSelectorJson: json({
      type: "repository_workspace",
      checkoutMode: "metadata_only",
      executionPath: ".",
      codebaseScope: { mode: "all", codebaseIds: [] },
    }),
    agentTeamRunPlanJson: json({
      strategy: "block_graph",
      leader: args.leaderAgentId,
      blocks: [
        {
          id: "scan_pull_request_rules",
          type: "plugin_tool",
          title: args.text("softwareTeam.workflowPresets.mrReview.blocks.scan"),
          agentId: args.leaderAgentId,
          dependsOn: [],
          instruction: args.text("softwareTeam.workflowPresets.mrReview.instructions.scan"),
          action: "execute_plugin_tool",
          tool: "plugin.tool",
          pluginRef: "official.gitea.tool_bundle",
          toolRef: "gitea.pull_request.rule_scan",
          pluginBaseUrl: "",
          pluginTokenRef: "",
          payloadTemplate: json({
            repo_id: "${taskRun.input.repo_id}",
            repo_url: "${taskRun.input.repo_url}",
            pull_request_index: "${taskRun.input.pull_request_index}",
            changed_files: "${taskRun.input.changed_files}",
            diff_ref: "${taskRun.input.diff_ref}",
            rules: [
              {
                id: "mr.todo_marker",
                category: "code_review",
                severity: "low",
                title: args.text("softwareTeam.workflowPresets.rules.todo.title"),
                description: args.text("softwareTeam.workflowPresets.rules.todo.description"),
                recommendation: args.text("softwareTeam.workflowPresets.rules.todo.recommendation"),
                lineRegex: "\\bTO" + "DO\\b|\\bFIX" + "ME\\b",
                knowledgeRefs: ["cleancode"],
              },
              {
                id: "mr.any_type",
                category: "code_review",
                severity: "medium",
                title: args.text("softwareTeam.workflowPresets.rules.anyType.title"),
                description: args.text("softwareTeam.workflowPresets.rules.anyType.description"),
                recommendation: args.text("softwareTeam.workflowPresets.rules.anyType.recommendation"),
                lineRegex: "(?:\\bas\\s+" + "any\\b|:\\s*" + "any\\b|<" + "any>)",
                knowledgeRefs: ["cleancode"],
              },
              {
                id: "mr.secret_like_assignment",
                category: "security",
                severity: "high",
                title: args.text("softwareTeam.workflowPresets.rules.secret.title"),
                description: args.text("softwareTeam.workflowPresets.rules.secret.description"),
                recommendation: args.text("softwareTeam.workflowPresets.rules.secret.recommendation"),
                lineRegex: "(secret|token|password|private[_-]?key)\\s*[:=]",
                knowledgeRefs: ["security"],
              },
            ],
          }),
          knowledgeCategory: "codebase",
          repositoryName: args.codebaseName,
        },
        {
          id: "publish_pull_request_findings",
          type: "publisher",
          title: args.text("softwareTeam.workflowPresets.mrReview.blocks.publish"),
          agentId: args.leaderAgentId,
          dependsOn: ["scan_pull_request_rules"],
          instruction: args.text("softwareTeam.workflowPresets.mrReview.instructions.publish"),
          action: "publish",
          tool: "plugin.publish",
          publisherRef: "official.gitea.publisher.pull_request_comment",
          pluginBaseUrl: "",
          pluginTokenRef: "",
          forEach: "finding",
          payloadTemplate: json({
            repo_id: "${taskRun.input.repo_id}",
            pull_request_index: "${taskRun.input.pull_request_index}",
            body: {
              body: "[${finding.severity}] ${finding.title}\\n\\n${finding.description}\\n\\n${finding.recommendation}\\n\\n${finding.feedbackUrl}",
            },
          }),
        },
        {
          id: "summarize_review",
          type: "agent",
          title: args.text("softwareTeam.workflowPresets.mrReview.blocks.summarize"),
          agentId: args.leaderAgentId,
          dependsOn: ["scan_pull_request_rules", "publish_pull_request_findings"],
          instruction: args.text("softwareTeam.workflowPresets.mrReview.instructions.summarize"),
          action: "summarize",
          tool: "memory.retrieve",
          knowledgeCategory: "codebase",
          repositoryName: args.codebaseName,
        },
      ],
      objective: args.text("softwareTeam.workflowPresets.mrReview.objective"),
      aggregation: { agent: args.leaderAgentId, method: "deduplicate_rank_and_publish" },
      conflictResolution: { method: "leader_decision" },
    }),
    executionPolicyJson: json({
      allowedTools: ["plugin.tool", "plugin.publish", "memory.retrieve"],
      approvalRequiredTools: ["repo.issue.comment"],
      idempotencyKey: "${plugin_idempotency_key}",
      worktree: { enabled: false, cleanupOnComplete: true, failureMode: "degrade" },
    }),
  } satisfies TaskBlueprintDraft;
}

function buildCleanCodeCleanupBlueprint(args: {
  text: ReturnType<typeof useLanguageText>;
  options: TaskBlueprintEditorOptions;
  businessTeamId: string;
  agentTeam: AgentTeamOption;
  leaderAgentId: string;
  environmentId?: string | null;
  codebaseId?: string;
  codebaseName?: string;
}) {
  const blueprint = baseBlueprint({
    id: taskId("task_cleancode_daily_cleanup", args.businessTeamId),
    name: args.text("softwareTeam.workflowPresets.cleanCode.name"),
    category: "software_delivery",
    businessTeamId: args.businessTeamId,
    agentTeamId: args.agentTeam.id,
    environmentId: args.environmentId ?? null,
    providerAdapterId: providerAdapterId(args.options),
  });
  const selectedCodebaseIds = args.codebaseId ? [args.codebaseId] : [];

  return {
    ...blueprint,
    triggerJson: json({
      type: "cron",
      expression: "0 9 * * 1-5",
      idempotencyKey: "${task_blueprint_id}:${run_date}",
    }),
    inputSchemaJson: json({
      type: "object",
      properties: {
        codebase_id: { type: "string" },
        run_date: { type: "string" },
      },
    }),
    environmentSelectorJson: json({
      type: "repository_workspace",
      checkoutMode: "full_clone",
      executionPath: ".",
      codebaseScope: {
        mode: selectedCodebaseIds.length > 0 ? "selected" : "all",
        codebaseIds: selectedCodebaseIds,
      },
    }),
    agentTeamRunPlanJson: json({
      strategy: "block_graph",
      leader: args.leaderAgentId,
      blocks: [
        {
          id: "load_cleancode_context",
          type: "agent",
          title: args.text("softwareTeam.workflowPresets.cleanCode.blocks.loadContext"),
          agentId: args.leaderAgentId,
          dependsOn: [],
          instruction: args.text("softwareTeam.workflowPresets.cleanCode.instructions.loadContext"),
          action: "retrieve_context",
          tool: "memory.retrieve",
          knowledgeCategory: args.codebaseName ? "codebase" : "domain",
          repositoryName: args.codebaseName,
        },
        {
          id: "scan_cleancode_alerts",
          type: "plugin_tool",
          title: args.text("softwareTeam.workflowPresets.cleanCode.blocks.scan"),
          agentId: args.leaderAgentId,
          dependsOn: ["load_cleancode_context"],
          instruction: args.text("softwareTeam.workflowPresets.cleanCode.instructions.scan"),
          action: "execute_plugin_tool",
          tool: "plugin.tool",
          pluginRef: "official.software_team.tool_bundle",
          toolRef: "software_team.cleancode.local_scan",
          payloadTemplate: json({
            repo_id: "${taskRun.input.codebase_name}",
            maxFiles: 1200,
            maxFindings: 80,
            lineThresholds: {
              app: 650,
              components: 900,
              server: 1400,
              default: 900,
            },
          }),
          knowledgeCategory: args.codebaseName ? "codebase" : "domain",
          repositoryName: args.codebaseName,
        },
        {
          id: "summarize_cleanup_queue",
          type: "agent",
          title: args.text("softwareTeam.workflowPresets.cleanCode.blocks.summarize"),
          agentId: args.leaderAgentId,
          dependsOn: ["scan_cleancode_alerts"],
          instruction: args.text("softwareTeam.workflowPresets.cleanCode.instructions.summarize"),
          action: "summarize",
          tool: "memory.retrieve",
          knowledgeCategory: args.codebaseName ? "codebase" : "domain",
          repositoryName: args.codebaseName,
        },
        {
          id: "publish_cleanup_report",
          type: "notification",
          title: args.text("softwareTeam.workflowPresets.cleanCode.blocks.publish"),
          agentId: args.leaderAgentId,
          dependsOn: ["summarize_cleanup_queue"],
          instruction: args.text("softwareTeam.workflowPresets.cleanCode.instructions.publish"),
          action: "notify",
          tool: "connector.email",
          connectorType: "dashboard",
          publisherRef: "dashboard",
        },
      ],
      objective: args.text("softwareTeam.workflowPresets.cleanCode.objective"),
      aggregation: { agent: args.leaderAgentId, method: "cleanup_queue_summary" },
      conflictResolution: { method: "leader_decision" },
    }),
    executionPolicyJson: json({
      allowedTools: ["plugin.tool", "memory.retrieve", "connector.email"],
      worktree: {
        enabled: true,
        baseDir: "data/worktrees",
        cleanupOnComplete: true,
        cloneDepth: 1,
        failureMode: "degrade",
      },
    }),
  } satisfies TaskBlueprintDraft;
}

function buildCodeShieldSweepBlueprint(args: {
  text: ReturnType<typeof useLanguageText>;
  options: TaskBlueprintEditorOptions;
  businessTeamId: string;
  agentTeam: AgentTeamOption;
  leaderAgentId: string;
  environmentId?: string | null;
  codebaseId?: string;
  codebaseName?: string;
}) {
  const blueprint = baseBlueprint({
    id: taskId("task_code_shield_repository_sweep", args.businessTeamId),
    name: args.text("softwareTeam.workflowPresets.codeShield.name"),
    category: "software_delivery",
    businessTeamId: args.businessTeamId,
    agentTeamId: args.agentTeam.id,
    environmentId: args.environmentId ?? null,
    providerAdapterId: providerAdapterId(args.options),
  });
  const selectedCodebaseIds = args.codebaseId ? [args.codebaseId] : [];

  return {
    ...blueprint,
    triggerJson: json({
      type: "cron",
      expression: "0 10 * * 1-5",
      idempotencyKey: "${task_blueprint_id}:${run_date}",
    }),
    inputSchemaJson: json({
      type: "object",
      properties: {
        codebase_id: { type: "string" },
        run_date: { type: "string" },
      },
    }),
    environmentSelectorJson: json({
      type: "repository_workspace",
      checkoutMode: "full_clone",
      executionPath: ".",
      codebaseScope: {
        mode: selectedCodebaseIds.length > 0 ? "selected" : "all",
        codebaseIds: selectedCodebaseIds,
      },
    }),
    agentTeamRunPlanJson: json({
      strategy: "block_graph",
      leader: args.leaderAgentId,
      blocks: [
        {
          id: "load_code_shield_context",
          type: "agent",
          title: args.text("softwareTeam.workflowPresets.codeShield.blocks.loadContext"),
          agentId: args.leaderAgentId,
          dependsOn: [],
          instruction: args.text("softwareTeam.workflowPresets.codeShield.instructions.loadContext"),
          action: "retrieve_context",
          tool: "memory.retrieve",
          knowledgeCategory: args.codebaseName ? "codebase" : "domain",
          repositoryName: args.codebaseName,
        },
        {
          id: "scan_code_shield_hotspots",
          type: "plugin_tool",
          title: args.text("softwareTeam.workflowPresets.codeShield.blocks.scan"),
          agentId: args.leaderAgentId,
          dependsOn: ["load_code_shield_context"],
          instruction: args.text("softwareTeam.workflowPresets.codeShield.instructions.scan"),
          action: "execute_plugin_tool",
          tool: "plugin.tool",
          pluginRef: "official.software_team.tool_bundle",
          toolRef: "software_team.code_shield.local_scan",
          payloadTemplate: json({
            repo_id: "${taskRun.input.codebase_name}",
            maxFiles: 1200,
            maxFindings: 80,
          }),
          knowledgeCategory: args.codebaseName ? "codebase" : "domain",
          repositoryName: args.codebaseName,
        },
        {
          id: "summarize_code_shield_findings",
          type: "agent",
          title: args.text("softwareTeam.workflowPresets.codeShield.blocks.summarize"),
          agentId: args.leaderAgentId,
          dependsOn: ["scan_code_shield_hotspots"],
          instruction: args.text("softwareTeam.workflowPresets.codeShield.instructions.summarize"),
          action: "summarize",
          tool: "memory.retrieve",
          knowledgeCategory: args.codebaseName ? "codebase" : "domain",
          repositoryName: args.codebaseName,
        },
        {
          id: "publish_code_shield_report",
          type: "notification",
          title: args.text("softwareTeam.workflowPresets.codeShield.blocks.publish"),
          agentId: args.leaderAgentId,
          dependsOn: ["summarize_code_shield_findings"],
          instruction: args.text("softwareTeam.workflowPresets.codeShield.instructions.publish"),
          action: "notify",
          tool: "connector.email",
          connectorType: "dashboard",
          publisherRef: "dashboard",
        },
      ],
      objective: args.text("softwareTeam.workflowPresets.codeShield.objective"),
      aggregation: { agent: args.leaderAgentId, method: "security_hotspot_triage" },
      conflictResolution: { method: "leader_decision" },
    }),
    dashboardPolicyJson: json({ board: "software_delivery", findingCategories: ["security", "code_shield"] }),
    executionPolicyJson: json({
      allowedTools: ["plugin.tool", "memory.retrieve", "connector.email"],
      worktree: {
        enabled: true,
        baseDir: "data/worktrees",
        cleanupOnComplete: true,
        cloneDepth: 1,
        failureMode: "degrade",
      },
    }),
  } satisfies TaskBlueprintDraft;
}

function PresetCard({
  icon,
  title,
  description,
  badge,
  disabled,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  badge: string;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <article className="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[var(--line)] bg-[var(--surface-muted)] text-[var(--accent)]">
            {icon}
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-[var(--ink)]">{title}</div>
            <div className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{description}</div>
          </div>
        </div>
        <Badge variant={disabled ? "neutral" : "accent"}>{badge}</Badge>
      </div>
      <div>{children}</div>
    </article>
  );
}

export function SoftwareTeamWorkflowStarter({ options, selectedBusinessTeamId }: Props) {
  const text = useLanguageText();
  const businessTeam = selectBusinessTeam(options, selectedBusinessTeamId);
  const agentTeam = businessTeam ? selectAgentTeam(options, businessTeam.id) : null;
  const leader = selectLeader(agentTeam);
  const environment = businessTeam ? selectEnvironment(options, businessTeam.id) : null;
  const codebase = businessTeam ? selectCodebase(options, businessTeam.id) : null;
  const disabled = !businessTeam || !agentTeam || !leader;

  const mrReviewBlueprint =
    businessTeam && agentTeam && leader
      ? buildMergeRequestReviewBlueprint({
          text,
          options,
          businessTeamId: businessTeam.id,
          agentTeam,
          leaderAgentId: leader.id,
          codebaseName: codebase?.name,
        })
      : null;
  const cleanCodeBlueprint =
    businessTeam && agentTeam && leader
      ? buildCleanCodeCleanupBlueprint({
          text,
          options,
          businessTeamId: businessTeam.id,
          agentTeam,
          leaderAgentId: leader.id,
          environmentId: environment?.id,
          codebaseId: codebase?.id,
          codebaseName: codebase?.name,
        })
      : null;
  const codeShieldBlueprint =
    businessTeam && agentTeam && leader
      ? buildCodeShieldSweepBlueprint({
          text,
          options,
          businessTeamId: businessTeam.id,
          agentTeam,
          leaderAgentId: leader.id,
          environmentId: environment?.id,
          codebaseId: codebase?.id,
          codebaseName: codebase?.name,
        })
      : null;

  return (
    <Panel>
      <PanelHeader
        eyebrow={text("softwareTeam.workflowStarter.eyebrow")}
        title={text("softwareTeam.workflowStarter.title")}
        description={text("softwareTeam.workflowStarter.description")}
      />
      <PanelBody>
        {disabled ? (
          <div className="mb-4 rounded-lg border border-dashed border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-sm text-[var(--ink-muted)]">
            {text("softwareTeam.workflowStarter.disabled")}
          </div>
        ) : null}
        <div className="grid gap-4 xl:grid-cols-3">
          <PresetCard
            icon={<GitPullRequestArrow className="h-5 w-5" />}
            title={text("softwareTeam.workflowPresets.mrReview.name")}
            description={text("softwareTeam.workflowPresets.mrReview.description")}
            badge={text("softwareTeam.workflowPresets.mrReview.badge")}
            disabled={disabled}
          >
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" size="sm" variant="secondary" disabled={disabled || !mrReviewBlueprint}>
                  <ShieldCheck className="h-4 w-4" />
                  {text("softwareTeam.workflowStarter.create")}
                </Button>
              </DialogTrigger>
              {mrReviewBlueprint ? (
                <DialogContent className="w-[min(96vw,1180px)]">
                  <DialogHeader>
                    <DialogTitle>{text("softwareTeam.workflowPresets.mrReview.dialogTitle")}</DialogTitle>
                    <DialogDescription>{text("softwareTeam.workflowPresets.mrReview.dialogDescription")}</DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <TaskBlueprintEditor
                      embedded
                      title={text("softwareTeam.workflowPresets.mrReview.dialogTitle")}
                      blueprint={mrReviewBlueprint}
                      options={options}
                    />
                  </DialogBody>
                </DialogContent>
              ) : null}
            </Dialog>
          </PresetCard>

          <PresetCard
            icon={<ShieldAlert className="h-5 w-5" />}
            title={text("softwareTeam.workflowPresets.codeShield.name")}
            description={text("softwareTeam.workflowPresets.codeShield.description")}
            badge={text("softwareTeam.workflowPresets.codeShield.badge")}
            disabled={disabled}
          >
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" size="sm" variant="secondary" disabled={disabled || !codeShieldBlueprint}>
                  <ShieldCheck className="h-4 w-4" />
                  {text("softwareTeam.workflowStarter.create")}
                </Button>
              </DialogTrigger>
              {codeShieldBlueprint ? (
                <DialogContent className="w-[min(96vw,1180px)]">
                  <DialogHeader>
                    <DialogTitle>{text("softwareTeam.workflowPresets.codeShield.dialogTitle")}</DialogTitle>
                    <DialogDescription>{text("softwareTeam.workflowPresets.codeShield.dialogDescription")}</DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <TaskBlueprintEditor
                      embedded
                      title={text("softwareTeam.workflowPresets.codeShield.dialogTitle")}
                      blueprint={codeShieldBlueprint}
                      options={options}
                    />
                  </DialogBody>
                </DialogContent>
              ) : null}
            </Dialog>
          </PresetCard>

          <PresetCard
            icon={<CalendarClock className="h-5 w-5" />}
            title={text("softwareTeam.workflowPresets.cleanCode.name")}
            description={text("softwareTeam.workflowPresets.cleanCode.description")}
            badge={text("softwareTeam.workflowPresets.cleanCode.badge")}
            disabled={disabled}
          >
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" size="sm" variant="secondary" disabled={disabled || !cleanCodeBlueprint}>
                  <ShieldCheck className="h-4 w-4" />
                  {text("softwareTeam.workflowStarter.create")}
                </Button>
              </DialogTrigger>
              {cleanCodeBlueprint ? (
                <DialogContent className="w-[min(96vw,1180px)]">
                  <DialogHeader>
                    <DialogTitle>{text("softwareTeam.workflowPresets.cleanCode.dialogTitle")}</DialogTitle>
                    <DialogDescription>{text("softwareTeam.workflowPresets.cleanCode.dialogDescription")}</DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <TaskBlueprintEditor
                      embedded
                      title={text("softwareTeam.workflowPresets.cleanCode.dialogTitle")}
                      blueprint={cleanCodeBlueprint}
                      options={options}
                    />
                  </DialogBody>
                </DialogContent>
              ) : null}
            </Dialog>
          </PresetCard>
        </div>
      </PanelBody>
    </Panel>
  );
}
