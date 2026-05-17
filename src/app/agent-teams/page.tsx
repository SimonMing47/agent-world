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
    collaborative: "ui.common.workflow.teamStructure.collaborative",
    reviewer_publisher: "ui.common.workflow.teamStructure.reviewerPublisher",
    custom: "ui.common.workflow.teamStructure.custom",
  };
  return labels[value] ?? value;
}

function translateAccessLevel(value: string) {
  const labels: Record<string, string> = {
    owner: "ui.common.workflow.accessLevel.owner",
    viewer: "ui.common.workflow.accessLevel.viewer",
    operator: "ui.common.workflow.accessLevel.operator",
    editor: "ui.common.workflow.accessLevel.editor",
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
    name: "",
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
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.cd4f6dd33b7"
        title="ui.generated.c756547fe41"
        description="ui.generated.cca6845699e"
        badges={[
          { label: <>{teams.length} ui.common.count.agentTeams</>, variant: "accent" },
          { label: <>{members.length} ui.generated.c6fa3ec603b</>, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "ui.generated.c044f1aaa0e",
            value: teams.length,
            detail: <>{teams.filter((team) => team.visibility === "global").length} ui.common.detail.globalVisible</>,
          },
          {
            label: "ui.generated.c7fb887709e",
            value: members.length,
            detail: <>{members.filter((member) => member.status === "active").length} ui.common.detail.activeOrchestrationMembers</>,
          },
          {
            label: "ui.generated.ce89edd2532",
            value: shares.length,
            detail: <>{new Set(shares.map((share) => share.businessTeamId)).size} ui.common.detail.authorizedBusinessTeams</>,
          },
          {
            label: "ui.generated.c421ea172a3",
            value: agentDefinitions.length,
            detail: <>{executionPolicies.length} ui.common.detail.availableExecutionPolicies</>,
          },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.c41e5243e2d"
          title="ui.generated.c756547fe41"
          description="ui.generated.c491928c3ae"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  ui.generated.c77ea648602
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(96vw,1180px)]">
                <DialogHeader>
                  <DialogTitle>ui.generated.c77ea648602</DialogTitle>
                  <DialogDescription>ui.generated.c9a87071575</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <AgentTeamForm
	                    embedded
	                    title="ui.generated.c77ea648602"
	                    team={buildNewTeamTemplate("", null)}
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
                <DataTableHead>ui.generated.c70f970c1fc</DataTableHead>
                <DataTableHead>ui.generated.c26f30fd79b</DataTableHead>
                <DataTableHead>ui.generated.c81a1f1c296</DataTableHead>
                <DataTableHead>ui.generated.c7fb887709e</DataTableHead>
                <DataTableHead>ui.generated.cd594b41326</DataTableHead>
                <DataTableHead>ui.generated.c093dea88c9</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
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
                        Leader: {leader?.name ?? "ui.generated.c8c577dc72c"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{ownerBusinessTeam?.name ?? "ui.generated.c8c577dc72c"}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {executionPolicy?.name ?? "ui.generated.c26801dc990"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{translateWorkflowType(team.workflowType)}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {translateTeamStructure(workflow.teamStructure)}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{teamMembers.length} ui.generated.ce8bf2e8cb2</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {roleSummary || "ui.generated.caf1c75f2b4"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>
                      <div>{translateVisibility(team.visibility)}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">
                        {teamShares.length > 0
                          ? <>ui.common.shareToPrefix {teamShares.length} ui.common.count.teams</>
                          : "ui.generated.c1743329113"}
                      </div>
                    </DataTableCell>
                    <DataTableCell>{formatDateTime(team.updatedAt)}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex items-center justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                              ui.generated.cf7acefd2d4
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,1080px)]">
                            <DialogHeader>
                              <DialogTitle>{team.name}</DialogTitle>
                              <DialogDescription>ui.generated.ce0b6c2a1ec</DialogDescription>
                            </DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                items={[
                                  { label: "ui.generated.c26f30fd79b", value: ownerBusinessTeam?.name ?? "ui.generated.c8c577dc72c" },
                                  { label: "ui.generated.c747b74cec9", value: translateVisibility(team.visibility) },
                                  { label: "ui.generated.ccc19798b0c", value: translateWorkflowType(team.workflowType) },
                                  { label: "ui.generated.c16dc2c92c6", value: translateTeamStructure(workflow.teamStructure) },
                                  { label: "Leader", value: leader?.name ?? "ui.generated.c8c577dc72c" },
                                  { label: "ui.generated.c9d3ef9b7be", value: executionPolicy?.name ?? "ui.generated.c3bf179d8d0" },
                                  { label: "ui.generated.cad9cc2683a", value: String(team.maxConcurrency) },
                                  { label: "ui.generated.cff06c243d7", value: `${Math.round(team.timeoutMs / 60000)} min` },
                                  { label: "ui.generated.c1ce42c1fd6", value: `${Math.round(team.successRateThreshold * 100)}%` },
                                  { label: "ui.generated.c093dea88c9", value: formatDateTime(team.updatedAt) },
                                ]}
                              />

                              <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--ink)]">ui.generated.c0ed5cf4445</div>
                                <div className="rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] px-4 py-3 text-sm leading-6 text-[var(--ink)]">
                                  {team.description || "ui.generated.c287a1d1034"}
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--ink)]">ui.generated.c3d23524681</div>
                                <pre className="max-h-[220px] overflow-auto whitespace-pre-wrap rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--ink)]">
                                  {team.orchestrationPrompt || "ui.generated.c287a1d1034"}
                                </pre>
                              </div>

                              <DefinitionList
                                items={[
                                  { label: "ui.generated.c6a361e464d", value: workflow.teamObjective || "ui.generated.c47024abd2c" },
                                  { label: "ui.generated.cbab38435a9", value: workflow.aggregationMethod },
                                  { label: "ui.generated.c4aeeacc808", value: workflow.conflictResolution },
                                  { label: "ui.generated.c815a1c560d", value: workflow.splitStrategy || "ui.generated.c47024abd2c" },
                                ]}
                              />

                              <div className="space-y-3">
                                <div className="text-sm font-medium text-[var(--ink)]">ui.generated.c7fb887709e</div>
                                <div className="overflow-hidden rounded-xl border border-[var(--line)]">
                                  <DataTable>
                                    <DataTableHeader>
                                      <DataTableRow>
                                        <DataTableHead>ui.generated.c20ee03ce77</DataTableHead>
                                        <DataTableHead>Agent</DataTableHead>
                                        <DataTableHead>ui.generated.cf39bcb6746</DataTableHead>
                                        <DataTableHead>ui.generated.c62e951a692</DataTableHead>
                                        <DataTableHead>ui.generated.c2a76f7b961</DataTableHead>
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
                                          <DataTableCell>{member.workInstruction || "ui.generated.c5a80718a62"}</DataTableCell>
                                        </DataTableRow>
                                      ))}
                                    </DataTableBody>
                                  </DataTable>
                                </div>
                              </div>

                              <div className="space-y-3">
                                <div className="text-sm font-medium text-[var(--ink)]">ui.generated.c21a61d9642</div>
                                <div className="overflow-hidden rounded-xl border border-[var(--line)]">
                                  <DataTable>
                                    <DataTableHeader>
                                      <DataTableRow>
                                        <DataTableHead>ui.generated.c2b90028ff3</DataTableHead>
                                        <DataTableHead>ui.generated.cf1b1d674c3</DataTableHead>
                                      </DataTableRow>
                                    </DataTableHeader>
                                    <DataTableBody>
                                      <DataTableRow>
                                        <DataTableCell>{ownerBusinessTeam?.name ?? "ui.generated.c8c577dc72c"}</DataTableCell>
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
                              ui.generated.ca7f814c0a4
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,1180px)]">
                            <DialogHeader>
                              <DialogTitle>ui.generated.ca7f814c0a4 {team.name}</DialogTitle>
                              <DialogDescription>ui.generated.c423411c827</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <AgentTeamForm
                                embedded
                                title="actions.edit"
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
                        <DeleteResourceButton endpoint="/api/agent-teams" id={team.id} confirmParams={{ resource: "ui.common.resources.agentTeam", name: team.name }} />
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
