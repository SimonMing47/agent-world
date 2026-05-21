import { Eye, PencilLine, Plus } from "lucide-react";
import { ExecutionPolicyForm } from "@/components/admin-forms";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
import { Panel, PanelBody, PanelHeader } from "@/components/ui/panel";
import { buildExecutionPolicySummary } from "@/server/execution-policy-core";
import { translateExecutionPolicyScope } from "@/lib/presentation";
import { canAccessBusinessTeam, filterBusinessTeamsForAuthContext, getRequestAuthContext } from "@/server/auth-core";
import { listAgentTeams, listBusinessTeams, listExecutionPolicies, listTenantSpaces } from "@/server/queries";

function scopeOf(profile: { teamId: string | null; businessTeamId: string | null; tenantSpaceId: string | null }) {
  return profile.teamId ? "ui.generated.c70f970c1fc" : profile.businessTeamId ? "ui.generated.c2b90028ff3" : profile.tenantSpaceId ? "ui.generated.c3db35d2741" : "ui.generated.ca5644f4bbf";
}

export default async function ExecutionPolicyPage() {
  const authContext = await getRequestAuthContext();
  const tenantSpaces = listTenantSpaces();
  const businessTeams = filterBusinessTeamsForAuthContext(listBusinessTeams(), authContext);
  const visibleBusinessTeamIds = new Set(businessTeams.map((team) => team.id));
  const agentTeams = listAgentTeams().filter((team) => visibleBusinessTeamIds.has(team.businessTeamId));
  const visibleAgentTeamIds = new Set(agentTeams.map((team) => team.id));
  const executionPolicies = listExecutionPolicies().filter((policy) =>
    policy.teamId
      ? visibleAgentTeamIds.has(policy.teamId)
      : canAccessBusinessTeam(authContext, policy.businessTeamId, { allowGlobal: true }),
  );
  const tenantOptions = tenantSpaces.map((space) => ({ id: space.id, name: space.name }));
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));
  const agentTeamOptions = agentTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="ui.generated.c6408e9f93d"
        title="ui.generated.c6408e9f93d"
        description="ui.generated.c275dbd5d7b"
        badges={[{ label: <>{executionPolicies.length} ui.common.count.executionPolicies</>, variant: "accent" }]}
      />

      <Panel>
        <PanelHeader
          eyebrow="ui.generated.c41e5243e2d"
          title="ui.generated.cd5d169228c"
          description="ui.generated.c756b8eca35"
          action={
            <Dialog>
              <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />ui.generated.c294d9cb571</Button></DialogTrigger>
              <DialogContent className="w-[min(96vw,980px)]">
                <DialogHeader><DialogTitle>ui.generated.c0da4967602</DialogTitle><DialogDescription>ui.generated.ccd5cad2742</DialogDescription></DialogHeader>
                <DialogBody>
                  <ExecutionPolicyForm
                    tenantSpaces={tenantOptions}
                    businessTeams={teamOptions}
                    agentTeams={agentTeamOptions}
                    policy={{
                      id: "",
                      tenantSpaceId: null,
                      businessTeamId: null,
                      teamId: null,
                      name: "",
                      systemInstruction: "",
                      toolPolicyJson: JSON.stringify({ allow: [], deny: [] }, null, 2),
                      approvalPolicyJson: JSON.stringify({ mode: "ask" }, null, 2),
                      budgetPolicyJson: JSON.stringify({ maxRuntimeMinutes: 30, maxSteps: 20, maxToolCalls: 50 }, null, 2),
                      outputPolicyJson: "{}",
                      securityPolicyJson: "{}",
                    }}
                  />
                </DialogBody>
              </DialogContent>
            </Dialog>
          }
        />
        <PanelBody className="p-0">
          <DataTable>
            <DataTableHeader>
              <DataTableRow className="hover:bg-transparent">
                <DataTableHead>ui.generated.cf3c49831c6</DataTableHead>
                <DataTableHead>ui.generated.c785b52eb97</DataTableHead>
                <DataTableHead>ui.generated.cc4a935a9c3</DataTableHead>
                <DataTableHead>ui.generated.c1ce79677a9</DataTableHead>
                <DataTableHead>ui.generated.c8e662a5618</DataTableHead>
                <DataTableHead align="right">ui.generated.cf3ea6d345e</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {executionPolicies.map((profile) => {
                const executionPolicy = buildExecutionPolicySummary(profile);
                const scope = scopeOf(profile);
                return (
                  <DataTableRow key={profile.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{executionPolicy.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{executionPolicy.instruction}</div>
                    </DataTableCell>
                    <DataTableCell><Badge variant="neutral">{translateExecutionPolicyScope(scope)}</Badge></DataTableCell>
                    <DataTableCell>{executionPolicy.budget.maxRuntimeMinutes} ui.generated.cc15da1ef70 {executionPolicy.budget.maxToolCalls} ui.generated.c02acc3b1c4</DataTableCell>
                    <DataTableCell>{executionPolicy.approvalRequiredTools.join(", ") || "ui.generated.c72077749f7"}</DataTableCell>
                    <DataTableCell>{executionPolicy.safety.promptScan ? "ui.generated.cea15810cf6" : "ui.generated.cd35af39b0a"}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><Eye className="h-4 w-4" />ui.generated.cf7acefd2d4</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{profile.name}</DialogTitle><DialogDescription>ui.generated.c0fc696b711</DialogDescription></DialogHeader>
                            <DialogBody>
                              <DefinitionList
                                items={[
                                  { label: "ui.generated.c225a81e171", value: profile.id },
                                  { label: "ui.generated.cc15757bcfa", value: profile.toolPolicyJson },
                                  { label: "ui.generated.c065633d525", value: profile.approvalPolicyJson },
                                  { label: "ui.generated.c4499bd58a7", value: profile.budgetPolicyJson },
                                  { label: "ui.generated.c084415a1ec", value: profile.outputPolicyJson },
                                  { label: "ui.generated.c7fb27626a0", value: profile.securityPolicyJson },
                                ]}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />ui.generated.ca7f814c0a4</Button></DialogTrigger>
                          <DialogContent className="w-[min(96vw,980px)]">
                            <DialogHeader><DialogTitle>ui.generated.c1866d4c0fb</DialogTitle><DialogDescription>{profile.name}</DialogDescription></DialogHeader>
                            <DialogBody><ExecutionPolicyForm tenantSpaces={tenantOptions} businessTeams={teamOptions} agentTeams={agentTeamOptions} policy={profile} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/execution-policies" id={profile.id} confirmParams={{ resource: "ui.common.resources.executionPolicy", name: profile.name }} />
                      </div>
                    </DataTableCell>
                  </DataTableRow>
                );
              })}
            </DataTableBody>
          </DataTable>
        </PanelBody>
      </Panel>
    </div>
  );
}
