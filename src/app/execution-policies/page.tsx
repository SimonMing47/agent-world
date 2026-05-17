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
import { listAgentTeams, listBusinessTeams, listExecutionPolicies, listTenantSpaces } from "@/server/queries";

function scopeOf(profile: { teamId: string | null; businessTeamId: string | null; tenantSpaceId: string | null }) {
  return profile.teamId ? "Agent 团队" : profile.businessTeamId ? "业务团队" : profile.tenantSpaceId ? "租户空间" : "全局";
}

export default function ExecutionPolicyPage() {
  const executionPolicies = listExecutionPolicies();
  const tenantSpaces = listTenantSpaces();
  const businessTeams = listBusinessTeams();
  const agentTeams = listAgentTeams();
  const tenantOptions = tenantSpaces.map((space) => ({ id: space.id, name: space.name }));
  const teamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));
  const agentTeamOptions = agentTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="执行策略"
        title="执行策略"
        description="统一配置工具许可、人工门禁、预算和输出安全策略，支持增删查改。"
        badges={[{ label: `${executionPolicies.length} 条执行策略`, variant: "accent" }]}
      />

      <Panel>
        <PanelHeader
          eyebrow="目录"
          title="执行策略目录"
          description="策略可作用于全局、租户、业务团队或 Agent 团队。"
          action={
            <Dialog>
              <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />新增策略</Button></DialogTrigger>
              <DialogContent className="w-[min(96vw,980px)]">
                <DialogHeader><DialogTitle>新增执行策略</DialogTitle><DialogDescription>配置策略适用范围和各类 JSON 规则。</DialogDescription></DialogHeader>
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
                      name: "新增执行策略",
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
                <DataTableHead>策略</DataTableHead>
                <DataTableHead>范围</DataTableHead>
                <DataTableHead>预算约束</DataTableHead>
                <DataTableHead>人工门禁</DataTableHead>
                <DataTableHead>安全</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
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
                    <DataTableCell>{executionPolicy.budget.maxRuntimeMinutes} 分钟 / {executionPolicy.budget.maxToolCalls} 次工具</DataTableCell>
                    <DataTableCell>{executionPolicy.approvalRequiredTools.join(", ") || "无"}</DataTableCell>
                    <DataTableCell>{executionPolicy.safety.promptScan ? "Prompt 扫描" : "未开扫描"}</DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><Eye className="h-4 w-4" />查看</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{profile.name}</DialogTitle><DialogDescription>执行策略明细。</DialogDescription></DialogHeader>
                            <DialogBody>
                              <DefinitionList
                                items={[
                                  { label: "策略 ID", value: profile.id },
                                  { label: "工具策略", value: profile.toolPolicyJson },
                                  { label: "审批策略", value: profile.approvalPolicyJson },
                                  { label: "预算策略", value: profile.budgetPolicyJson },
                                  { label: "输出策略", value: profile.outputPolicyJson },
                                  { label: "安全策略", value: profile.securityPolicyJson },
                                ]}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />编辑</Button></DialogTrigger>
                          <DialogContent className="w-[min(96vw,980px)]">
                            <DialogHeader><DialogTitle>编辑执行策略</DialogTitle><DialogDescription>{profile.name}</DialogDescription></DialogHeader>
                            <DialogBody><ExecutionPolicyForm tenantSpaces={tenantOptions} businessTeams={teamOptions} agentTeams={agentTeamOptions} policy={profile} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/execution-policies" id={profile.id} confirmText={`确认删除执行策略「${profile.name}」？`} />
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
