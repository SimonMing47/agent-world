import Link from "next/link";
import { Eye, Plus } from "lucide-react";
import { RuntimeSessionCreateForm } from "@/components/runtime-session-create-form";
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
import { formatDateTime } from "@/lib/utils";
import {
  listAgentDefinitions,
  listAgentTeams,
  listProviders,
  listProviderRuntimeBindings,
  listTenantSpaces,
  listBusinessTeams,
} from "@/server/queries";
import { listRuntimeSessions } from "@/server/runtime-session-core";

function statusVariant(status: string): "neutral" | "accent" | "success" | "warning" | "danger" {
  if (status === "running") return "accent";
  if (status === "error") return "danger";
  return "success";
}

export default function RuntimeInteractionsPage() {
  const runtimeSessions = listRuntimeSessions();
  const runtimeBindings = listProviderRuntimeBindings();
  const providerProfiles = listProviders();
  const agentTeams = listAgentTeams();
  const agentDefinitions = listAgentDefinitions();
  const tenantSpaceId = listTenantSpaces()[0]?.id ?? "";
  const businessTeamId = listBusinessTeams()[0]?.id ?? "";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Interactions"
        title="模型交互工作台"
        description="会话、团队协作和人工介入统一通过运行时会话管理。"
        badges={[
          { label: `${runtimeSessions.length} 个会话`, variant: "accent" },
          { label: `${runtimeBindings.length} 个运行时`, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "会话数",
            value: runtimeSessions.length,
            detail: `${runtimeSessions.filter((session) => session.status === "running").length} 个运行中`,
          },
          {
            label: "Agent Team 会话",
            value: runtimeSessions.filter((session) => session.mode === "agent_team").length,
            detail: "支持多 Agent 协作输出",
          },
          {
            label: "运行时绑定",
            value: runtimeBindings.length,
            detail: `${providerProfiles.length} 个模型接口可选`,
          },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="Sessions"
          title="运行时会话"
          description="已创建的模型交互会话统一在表格里管理。"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  新建会话
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(92vw,860px)]">
                <DialogHeader>
                  <DialogTitle>新建运行时会话</DialogTitle>
                  <DialogDescription>选择运行时、模型接口和单 Agent 或 Team 模式。</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <RuntimeSessionCreateForm
                    tenantSpaceId={tenantSpaceId}
                    businessTeamId={businessTeamId}
                    runtimeBindings={runtimeBindings}
                    providerProfiles={providerProfiles}
                    agentTeams={agentTeams.map((team) => ({ id: team.id, name: team.name }))}
                    agentDefinitions={agentDefinitions.map((definition) => ({
                      id: definition.id,
                      name: definition.name,
                      systemPrompt: definition.systemPrompt,
                      model: definition.model,
                      defaultProviderProfileId: definition.defaultProviderProfileId,
                      defaultRuntimeBindingId: definition.defaultRuntimeBindingId,
                      harnessConfigJson: definition.harnessConfigJson,
                      permissionPolicyJson: definition.permissionPolicyJson,
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
                <DataTableHead>会话</DataTableHead>
                <DataTableHead>模式</DataTableHead>
                <DataTableHead>运行时</DataTableHead>
                <DataTableHead>模型</DataTableHead>
                <DataTableHead>状态</DataTableHead>
                <DataTableHead>更新时间</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {runtimeSessions.map((session) => {
                const runtime = runtimeBindings.find((binding) => binding.id === session.runtimeBindingId);
                return (
                  <DataTableRow key={session.id}>
                    <DataTableCell className="min-w-[220px]">
                      <div className="font-medium text-[var(--ink)]">{session.title}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{session.id}</div>
                    </DataTableCell>
                    <DataTableCell>{session.mode}</DataTableCell>
                    <DataTableCell>{runtime?.name ?? "未知运行时"}</DataTableCell>
                    <DataTableCell>{session.model}</DataTableCell>
                    <DataTableCell>
                      <Badge variant={statusVariant(session.status)}>{session.status}</Badge>
                    </DataTableCell>
                    <DataTableCell>{formatDateTime(session.updatedAt)}</DataTableCell>
                    <DataTableCell align="right">
                      <Link href={`/interactions/${session.id}`}>
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                          打开
                        </Button>
                      </Link>
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
