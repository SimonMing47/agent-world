import { Eye, PencilLine, Plus } from "lucide-react";
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
import { SummaryStrip } from "@/components/ui/summary-strip";
import { WebhookEndpointForm } from "@/components/webhook-endpoint-form";
import { listAgentTeams, listBusinessTeams, listWebhooks } from "@/server/queries";

function defaultWebhook(businessTeamId: string, teamId: string) {
  return {
    id: "",
    businessTeamId,
    teamId,
    name: "新增 Webhook",
    pathKey: "new-webhook",
    method: "POST",
    requestSchemaJson: "{}",
    secretHint: "env:AGENTWORLD_WEBHOOK_SECRET",
    isEnabled: 1,
  };
}

export default function WebhooksPage() {
  const webhooks = listWebhooks();
  const businessTeams = listBusinessTeams();
  const agentTeams = listAgentTeams();
  const businessTeamOptions = businessTeams.map((team) => ({ id: team.id, name: team.name }));
  const agentTeamOptions = agentTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Webhook"
        title="Webhook 管理"
        description="Webhook 是任务蓝图的外部触发入口，负责校验路径、签名提示、请求 Schema 和接收的 Agent 团队。"
        badges={[
          { label: `${webhooks.length} 个入口`, variant: "accent" },
          { label: `启用 ${webhooks.filter((webhook) => webhook.isEnabled === 1).length}`, variant: "success" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "Webhook", value: webhooks.length, detail: "外部系统触发任务" },
          { label: "启用入口", value: webhooks.filter((item) => item.isEnabled === 1).length, detail: "可接收请求" },
          { label: "业务团队", value: new Set(webhooks.map((item) => item.businessTeamId)).size, detail: "按团队归属" },
          { label: "Agent 团队", value: new Set(webhooks.map((item) => item.teamId)).size, detail: "接收执行单元" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="入口目录"
          title="Webhook 入口目录"
          description="所有入口都可新增、查看、编辑和删除；具体代码平台解析能力由插件提供。"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  新增 Webhook
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(96vw,920px)]">
                <DialogHeader>
                  <DialogTitle>新增 Webhook</DialogTitle>
                  <DialogDescription>配置外部系统触发任务时使用的路径、团队和请求 Schema。</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <WebhookEndpointForm
                    embedded
                    title="新增 Webhook"
                    businessTeamOptions={businessTeamOptions}
                    agentTeamOptions={agentTeamOptions}
                    webhook={defaultWebhook(businessTeams[0]?.id ?? "", agentTeams[0]?.id ?? "")}
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
                <DataTableHead>Webhook</DataTableHead>
                <DataTableHead>业务团队</DataTableHead>
                <DataTableHead>Agent 团队</DataTableHead>
                <DataTableHead>方法 / 路径</DataTableHead>
                <DataTableHead>状态</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {webhooks.map((webhook) => {
                const businessTeam = businessTeams.find((item) => item.id === webhook.businessTeamId);
                const agentTeam = agentTeams.find((item) => item.id === webhook.teamId);
                return (
                  <DataTableRow key={webhook.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{webhook.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{webhook.id}</div>
                    </DataTableCell>
                    <DataTableCell>{businessTeam?.name ?? "未绑定"}</DataTableCell>
                    <DataTableCell>{agentTeam?.name ?? "未绑定"}</DataTableCell>
                    <DataTableCell>
                      <div>{webhook.method}</div>
                      <div className="mt-1 font-mono text-xs text-[var(--ink-muted)]">/api/webhooks/{webhook.pathKey}</div>
                    </DataTableCell>
                    <DataTableCell>
                      <Badge variant={webhook.isEnabled === 1 ? "success" : "neutral"}>{webhook.isEnabled === 1 ? "启用" : "停用"}</Badge>
                    </DataTableCell>
                    <DataTableCell align="right">
                      <div className="flex justify-end gap-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                              查看
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="w-[min(96vw,880px)]">
                            <DialogHeader>
                              <DialogTitle>{webhook.name}</DialogTitle>
                              <DialogDescription>Webhook 入口配置明细。</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <DefinitionList
                                columnsClassName="sm:grid-cols-2"
                                items={[
                                  { label: "ID", value: webhook.id },
                                  { label: "业务团队", value: businessTeam?.name ?? "未绑定" },
                                  { label: "Agent 团队", value: agentTeam?.name ?? "未绑定" },
                                  { label: "HTTP 方法", value: webhook.method },
                                  { label: "路径标识", value: webhook.pathKey },
                                  { label: "调用路径", value: `/api/webhooks/${webhook.pathKey}` },
                                  { label: "签名密钥引用", value: webhook.secretHint || "未配置" },
                                  { label: "请求 Schema", value: <pre className="whitespace-pre-wrap font-mono text-xs">{webhook.requestSchemaJson}</pre> },
                                ]}
                              />
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
                          <DialogContent className="w-[min(96vw,920px)]">
                            <DialogHeader>
                              <DialogTitle>编辑 Webhook</DialogTitle>
                              <DialogDescription>{webhook.name}</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <WebhookEndpointForm
                                embedded
                                title={`编辑 ${webhook.name}`}
                                businessTeamOptions={businessTeamOptions}
                                agentTeamOptions={agentTeamOptions}
                                webhook={webhook}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton
                          endpoint="/api/webhooks"
                          id={webhook.id}
                          confirmText={`确认删除 Webhook「${webhook.name}」？`}
                        />
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
