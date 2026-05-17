import { Eye, PencilLine, Plus } from "lucide-react";
import { AgentTeamForm } from "@/components/agent-team-form";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { DefinitionList } from "@/components/ui/definition-list";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { translateVisibility, translateWorkflowType, translateStatus } from "@/lib/presentation";
import { formatDateTime } from "@/lib/utils";
import {
  listAgentDefinitions,
  listAgentTeams,
  listAgentTeamMemberProfiles,
  listAgentTeamShares,
  listBusinessTeams,
  listExecutionPolicies,
} from "@/server/queries";

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

function translateTeamStructure(value: string) {
  const labels: Record<string, string> = {
    leader_worker: "Leader / Worker",
    collaborative: "协作讨论",
    reviewer_publisher: "评审 / 发布",
    custom: "自定义",
  };
  return labels[value] ?? value;
}

function translateAccessLevel(value: string) {
  const labels: Record<string, string> = {
    owner: "归属团队",
    viewer: "可查看",
    operator: "可执行",
    editor: "可编辑",
  };
  return labels[value] ?? value;
}

function summarizeRoles(values: string[]) {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    const next = counts.get(value) ?? 0;
    counts.set(value, next + 1);
  });
  return Array.from(counts.entries())
    .map(([role, count]) => `${role} x${count}`)
    .join(", ");
}

function buildNewTeamTemplate(defaultBusinessTeamId: string, defaultExecutionPolicyId: string | null) {
  return {
    id: "",
    businessTeamId: defaultBusinessTeamId,
    slug: "",
    name: "New Agent Team",
    description: "",
    leaderAgentId: null,
    workflowType: "parallel",
    orchestrationPrompt: "",
    workflowDefinitionJson: JSON.stringify(
      {
        strategy: "parallel",
        teamStructure: "leader_worker",
        teamObjective: "",
        aggregationMethod: "leader_summary",
        conflictResolution: "leader_decision",
        splitStrategy: "",
      },
      null,
      2,
    ),
    inputSchemaJson: JSON.stringify({ type: "object" }, null, 2),
    outputSchemaJson: JSON.stringify({ type: "object" }, null, 2),
    maxConcurrency: 4,
    timeoutMs: 20 * 60 * 1000,
    successRateThreshold: 0.9,
    pricingModelJson: JSON.stringify({ baseUsd: 0, tokenMultiplier: 1 }, null, 2),
    visibility: "team",
    defaultExecutionPolicyId,
  };
}

export default function AgentTeamsPage() {
  const teams = listAgentTeams();
  const members = listAgentTeamMemberProfiles();
  const shares = listAgentTeamShares();
  const businessTeams = listBusinessTeams();
  const agentDefinitions = listAgentDefinitions();
  const executionPolicies = listExecutionPolicies();
  const defaultBusinessTeamId = businessTeams[0]?.id ?? "";
  const defaultExecutionPolicyId = executionPolicies[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Agent Teams"
        title="Agent 团队编排"
        description="从 Agent 定义目录中组装团队，配置 Team 结构、工作流、成员职责和共享到不同人类业务团队的可见性与使用权限。"
        badges={[
          { label: `${teams.length} 个 Agent Team`, variant: "accent" },
          { label: `${members.length} 个成员编排`, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "团队总数",
            value: teams.length,
            detail: `${teams.filter((team) => team.visibility === "global").length} 个全局可见`,
          },
          {
            label: "成员编排",
            value: members.length,
            detail: `${members.filter((member) => member.status === "active").length} 个启用中`,
          },
          {
            label: "共享关系",
            value: shares.length,
            detail: `${new Set(shares.map((share) => share.businessTeamId)).size} 个业务团队收到授权`,
          },
          {
            label: "可选 Agent",
            value: agentDefinitions.length,
            detail: `${executionPolicies.length} 条运行约束可绑定`,
          },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="Catalog"
          title="Agent Team 目录"
          description="已定义的团队以表格管理；查看和编辑通过弹窗完成。"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  新增 Team
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(96vw,1180px)]">
                <DialogHeader>
                  <DialogTitle>新增 Agent Team</DialogTitle>
                  <DialogDescription>选择 Agent 成员、定义 Team 工作流，并把它共享给需要使用它的业务团队。</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <AgentTeamForm
                    embedded
                    title="新增 Agent Team"
                    team={buildNewTeamTemplate(defaultBusinessTeamId, defaultExecutionPolicyId)}
                    members={[]}
                    shares={[]}
                    businessTeamOptions={businessTeams.map((team) => ({ id: team.id, name: team.name }))}
                    agentDefinitionOptions={agentDefinitions.map((definition) => ({
                      id: definition.id,
                      name: definition.name,
                      role: definition.role,
                    }))}
                    executionPolicyOptions={executionPolicies.map((policy) => ({
                      id: policy.id,
                      name: policy.name,
                    }))}
                  />
                </DialogBody>
              </DialogContent>
            </Dialog>
          }
        />
        <div className="overflow-hidden rounded-b-2xl">
          <DataTable>
            <DataTableHeader>
              <DataTableRow>
                <DataTableHead>Agent Team</DataTableHead>
                <DataTableHead>归属业务团队</DataTableHead>
                <DataTableHead>结构 / 工作流</DataTableHead>
                <DataTableHead>成员编排</DataTableHead>
                <DataTableHead>可见性 / 共享</DataTableHead>
                <DataTableHead>更新时间</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {teams.map((team) => {
                const teamMembers = members.filter((member) => member.teamId === team.id);
                const teamShares = shares.filter((share) => share.agentTeamId === team.id);
                const ownerBusinessTeam = businessTeams.find((item) => item.id === team.businessTeamId);
                const executionPolicy = executionPolicies.find(
                  (policy) => policy.id === team.defaultExecutionPolicyId,
                );
                const leader = teamMembers.find((member) => member.id === team.leaderAgentId);
                const workflow = parseWorkflowDefinition(team.workflowDefinitionJson);
                const roleSummary = summarizeRoles(
                  teamMembers.map((member) => member.memberRole || member.role).filter(Boolean),
                );

                return (
                  <DataTableRow key={team.id}>
                    <DataTableCell className="min-w-[240px]">
                      <div className="font-medium text-[var(--ink)]">{team.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{team.slug}</div>
                      <div className="mt-2 text-xs text-[var(--ink-muted)]">
                        Leader: {leader?.name ?? "未指定"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{ownerBusinessTeam?.name ?? "未指定"}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {executionPolicy?.name ?? "未绑定默认运行约束"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{translateWorkflowType(team.workflowType)}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {translateTeamStructure(workflow.teamStructure)}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{teamMembers.length} 个成员</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {roleSummary || "未配置职责"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{translateVisibility(team.visibility)}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {teamShares.length > 0
                          ? `共享给 ${teamShares.length} 个业务团队`
                          : "未共享给其他团队"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>{formatDateTime(team.updatedAt)}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex items-center justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                              查看
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,1080px)]">
                            <DialogHeader>
                              <DialogTitle>{team.name}</DialogTitle>
                              <DialogDescription>查看 Team 结构、成员编排、共享权限和工作流定义。</DialogDescription>
                            </DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                items={[
                                  { label: "归属业务团队", value: ownerBusinessTeam?.name ?? "未指定" },
                                  { label: "可见性", value: translateVisibility(team.visibility) },
                                  { label: "工作流", value: translateWorkflowType(team.workflowType) },
                                  { label: "团队结构", value: translateTeamStructure(workflow.teamStructure) },
                                  { label: "Leader", value: leader?.name ?? "未指定" },
                                  { label: "默认运行约束", value: executionPolicy?.name ?? "未绑定" },
                                  { label: "并发数", value: String(team.maxConcurrency) },
                                  { label: "超时", value: `${Math.round(team.timeoutMs / 60000)} 分钟` },
                                  { label: "成功率目标", value: `${Math.round(team.successRateThreshold * 100)}%` },
                                  { label: "更新时间", value: formatDateTime(team.updatedAt) },
                                ]}
                              />

                              <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--ink)]">团队说明</div>
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
                                  {team.description || "未填写"}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--ink)]">编排提示词</div>
                                <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--ink)]">
                                  {team.orchestrationPrompt || "未填写"}
                                </pre>
                              </div>

                              <DefinitionList
                                items={[
                                  { label: "团队目标", value: workflow.teamObjective || "未定义" },
                                  { label: "汇总方式", value: workflow.aggregationMethod },
                                  { label: "冲突处理", value: workflow.conflictResolution },
                                  { label: "拆分策略", value: workflow.splitStrategy || "未定义" },
                                ]}
                              />

                              <div className="space-y-3">
                                <div className="text-sm font-medium text-[var(--ink)]">成员编排</div>
                                <div className="overflow-hidden rounded-xl border border-[var(--line)]">
                                  <DataTable>
                                    <DataTableHeader>
                                      <DataTableRow>
                                        <DataTableHead>顺序</DataTableHead>
                                        <DataTableHead>Agent</DataTableHead>
                                        <DataTableHead>团队角色</DataTableHead>
                                        <DataTableHead>状态</DataTableHead>
                                        <DataTableHead>工作说明</DataTableHead>
                                      </DataTableRow>
                                    </DataTableHeader>
                                    <DataTableBody>
                                      {teamMembers.map((member, index) => (
                                        <DataTableRow key={member.id}>
                                          <DataTableCell>{index + 1}</DataTableCell>
                                          <DataTableCell>
                                            <div className="font-medium text-[var(--ink)]">{member.name}</div>
                                            <div className="mt-1 text-xs text-[var(--ink-muted)]">
                                              {member.role}
                                            </div>
                                          </DataTableCell>
                                          <DataTableCell>{member.memberRole}</DataTableCell>
                                          <DataTableCell>{translateStatus(member.status)}</DataTableCell>
                                          <DataTableCell>{member.workInstruction || "继承 Agent 默认职责"}</DataTableCell>
                                        </DataTableRow>
                                      ))}
                                    </DataTableBody>
                                  </DataTable>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="text-sm font-medium text-[var(--ink)]">共享到业务团队</div>
                                <div className="overflow-hidden rounded-xl border border-[var(--line)]">
                                  <DataTable>
                                    <DataTableHeader>
                                      <DataTableRow>
                                        <DataTableHead>业务团队</DataTableHead>
                                        <DataTableHead>访问级别</DataTableHead>
                                      </DataTableRow>
                                    </DataTableHeader>
                                    <DataTableBody>
                                      <DataTableRow>
                                        <DataTableCell>{ownerBusinessTeam?.name ?? "未指定"}</DataTableCell>
                                        <DataTableCell>{translateAccessLevel("owner")}</DataTableCell>
                                      </DataTableRow>
                                      {teamShares.map((share) => (
                                        <DataTableRow key={share.id}>
                                          <DataTableCell>
                                            {businessTeams.find((item) => item.id === share.businessTeamId)?.name ??
                                              share.businessTeamId}
                                          </DataTableCell>
                                          <DataTableCell>{translateAccessLevel(share.accessLevel)}</DataTableCell>
                                        </DataTableRow>
                                      ))}
                                    </DataTableBody>
                                  </DataTable>
                                </div>
                              </div>
                            </DialogBody>
                          </DialogContent>
                        </Dialog>

                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <PencilLine className="h-4 w-4" />
                              编辑
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,1180px)]">
                            <DialogHeader>
                              <DialogTitle>编辑 {team.name}</DialogTitle>
                              <DialogDescription>调整 Team 结构、工作流、共享权限和成员职责。</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <AgentTeamForm
                                embedded
                                title={`编辑 ${team.name}`}
                                team={team}
                                members={teamMembers.map((member) => ({
                                  id: member.id,
                                  agentDefinitionId: member.agentDefinitionId,
                                  memberRole: member.memberRole,
                                  workInstruction: member.workInstruction,
                                  position: member.position,
                                  status: member.status,
                                }))}
                                shares={teamShares.map((share) => ({
                                  businessTeamId: share.businessTeamId,
                                  accessLevel: share.accessLevel,
                                }))}
                                businessTeamOptions={businessTeams.map((item) => ({
                                  id: item.id,
                                  name: item.name,
                                }))}
                                agentDefinitionOptions={agentDefinitions.map((definition) => ({
                                  id: definition.id,
                                  name: definition.name,
                                  role: definition.role,
                                }))}
                                executionPolicyOptions={executionPolicies.map((policy) => ({
                                  id: policy.id,
                                  name: policy.name,
                                }))}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/agent-teams" id={team.id} confirmText={`确认删除 Agent Team「${team.name}」？`} />
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </div>
      </Panel>
    </div>
  );
}
