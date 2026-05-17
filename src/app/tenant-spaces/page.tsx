import { Eye, PencilLine, Plus } from "lucide-react";
import { TenantSpaceForm } from "@/components/admin-forms";
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
import { listBusinessTeams, listExecutionPolicies, listTenantSpaces } from "@/server/queries";

export default function TenantSpacesPage() {
  const tenantSpaces = listTenantSpaces();
  const businessTeams = listBusinessTeams();
  const executionPolicies = listExecutionPolicies();
  const policyOptions = executionPolicies.map((policy) => ({ id: policy.id, name: policy.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="租户空间"
        title="租户空间"
        description="维护租户、预算、模型白名单和全局策略。"
        badges={[{ label: `${tenantSpaces.length} 个租户空间`, variant: "accent" }]}
      />

      <Panel>
        <PanelHeader
          eyebrow="目录"
          title="租户空间目录"
          description="查看租户状态、配额和模型范围。"
          action={
            <Dialog>
              <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" />新增租户</Button></DialogTrigger>
              <DialogContent className="w-[min(94vw,900px)]">
                <DialogHeader><DialogTitle>新增租户空间</DialogTitle><DialogDescription>配置配额、模型白名单和全局 Guardrails。</DialogDescription></DialogHeader>
                <DialogBody>
                  <TenantSpaceForm
                    executionPolicies={policyOptions}
                    tenantSpace={{
                      id: "",
                      slug: "new-tenant",
                      name: "新增租户空间",
                      ownerUserId: "console",
                      status: "active",
                      quotaLimitJson: "{}",
                      modelWhitelistJson: "[]",
                      globalGuardrailsJson: "{}",
                      defaultExecutionPolicyId: null,
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
                <DataTableHead>租户</DataTableHead>
                <DataTableHead>业务团队</DataTableHead>
                <DataTableHead>默认策略</DataTableHead>
                <DataTableHead>Owner</DataTableHead>
                <DataTableHead>状态</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {tenantSpaces.map((tenantSpace) => {
                const teamCount = businessTeams.filter((team) => team.tenantSpaceId === tenantSpace.id).length;
                const policy = executionPolicies.find((item) => item.id === tenantSpace.defaultExecutionPolicyId);
                return (
                  <DataTableRow key={tenantSpace.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{tenantSpace.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{tenantSpace.slug}</div>
                    </DataTableCell>
                    <DataTableCell>{teamCount}</DataTableCell>
                    <DataTableCell>{policy?.name ?? "未绑定"}</DataTableCell>
                    <DataTableCell>{tenantSpace.ownerUserId}</DataTableCell>
                    <DataTableCell><Badge variant={tenantSpace.status === "active" ? "success" : "neutral"}>{tenantSpace.status}</Badge></DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><Eye className="h-4 w-4" />查看</Button></DialogTrigger>
                          <DialogContent>
                            <DialogHeader><DialogTitle>{tenantSpace.name}</DialogTitle><DialogDescription>租户空间明细。</DialogDescription></DialogHeader>
                            <DialogBody>
                              <DefinitionList
                                items={[
                                  { label: "租户 ID", value: tenantSpace.id },
                                  { label: "配额", value: tenantSpace.quotaLimitJson },
                                  { label: "模型白名单", value: tenantSpace.modelWhitelistJson },
                                  { label: "Guardrails", value: tenantSpace.globalGuardrailsJson },
                                ]}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <Dialog>
                          <DialogTrigger asChild><Button size="sm" variant="ghost"><PencilLine className="h-4 w-4" />编辑</Button></DialogTrigger>
                          <DialogContent className="w-[min(94vw,900px)]">
                            <DialogHeader><DialogTitle>编辑租户空间</DialogTitle><DialogDescription>{tenantSpace.name}</DialogDescription></DialogHeader>
                            <DialogBody><TenantSpaceForm executionPolicies={policyOptions} tenantSpace={tenantSpace} /></DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton endpoint="/api/tenant-spaces" id={tenantSpace.id} confirmText={`确认删除租户空间「${tenantSpace.name}」？`} />
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
