import { Eye, PencilLine, Plus } from "lucide-react";
import { DeleteResourceButton } from "@/components/delete-resource-button";
import { PageHeader } from "@/components/page-header";
import { ProviderRuntimeBindingForm } from "@/components/provider-runtime-binding-form";
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
import { getSettingsSnapshot } from "@/server/queries";

function parseConfig(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function stringField(value: unknown, fallback = "未配置") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function eventContractLabel(value: unknown) {
  const text = stringField(value, "agent_event_v1");
  return text === "provider_event_v1" ? "agent_event_v1" : text;
}

function defaultBinding(snapshot: ReturnType<typeof getSettingsSnapshot>) {
  const provider = snapshot.providers[0] ?? null;
  return {
    id: "",
    tenantSpaceId: snapshot.tenantSpaces[0]?.id ?? "",
    businessTeamId: null,
    adapterDefinitionId: snapshot.providerAdapters[0]?.id ?? "agentworld-runtime-adapter",
    name: "新增执行配置",
    runtimeKind: "agentworld",
    baseUrl: "embedded://agentworld/default",
    command: "embedded",
    workspaceRoot: ".",
    defaultProviderProfileId: provider?.id ?? null,
    apiKeyRef: provider?.apiKeyRef ?? "",
    configJson: JSON.stringify(
      {
        defaultModel: provider?.defaultModel ?? "",
        approvalMode: "ask",
        eventContract: "agent_event_v1",
        env: {},
      },
      null,
      2,
    ),
    isEnabled: 1,
  };
}

export default function RuntimeBindingsPage() {
  const snapshot = getSettingsSnapshot();
  const providerOptions = snapshot.providers.map((provider) => ({ id: provider.id, name: provider.name }));
  const adapterOptions = snapshot.providerAdapters.map((adapter) => ({ id: adapter.id, name: adapter.name }));
  const businessTeamOptions = snapshot.businessTeams.map((team) => ({ id: team.id, name: team.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="执行配置"
        title="模型执行配置"
        description="维护默认模型服务、密钥引用、执行参数和审批模式。"
        badges={[
          { label: `${snapshot.providerRuntimeBindings.length} 个执行配置`, variant: "accent" },
          { label: `启用 ${snapshot.providerRuntimeBindings.filter((binding) => binding.isEnabled === 1).length}`, variant: "success" },
        ]}
      />

      <SummaryStrip
        items={[
          { label: "执行配置", value: snapshot.providerRuntimeBindings.length, detail: "供 Agent 与任务引用" },
          { label: "启用", value: snapshot.providerRuntimeBindings.filter((item) => item.isEnabled === 1).length, detail: "当前可选" },
          { label: "模型服务", value: snapshot.providers.length, detail: "可治理服务" },
          { label: "团队绑定", value: snapshot.providerRuntimeBindings.filter((item) => item.businessTeamId).length, detail: "团队专属配置" },
        ]}
      />

      <Panel>
        <PanelHeader
          eyebrow="配置目录"
          title="执行配置目录"
          description="查看团队、默认模型、工作区和审批配置。"
          action={
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  <Plus className="h-4 w-4" />
                  新增执行配置
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[min(96vw,980px)]">
                <DialogHeader>
                  <DialogTitle>新增执行配置</DialogTitle>
                  <DialogDescription>配置默认模型服务、服务地址、密钥引用、审批模式和附加参数。</DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <ProviderRuntimeBindingForm
                    embedded
                    title="新增执行配置"
                    providerOptions={providerOptions}
                    adapterOptions={adapterOptions}
                    businessTeamOptions={businessTeamOptions}
                    binding={defaultBinding(snapshot)}
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
                <DataTableHead>执行配置</DataTableHead>
                <DataTableHead>归属业务团队</DataTableHead>
                <DataTableHead>默认模型服务</DataTableHead>
                <DataTableHead>服务地址</DataTableHead>
                <DataTableHead>状态</DataTableHead>
                <DataTableHead align="right">操作</DataTableHead>
              </DataTableRow>
            </DataTableHeader>
            <DataTableBody>
              {snapshot.providerRuntimeBindings.map((binding) => {
                const businessTeam = snapshot.businessTeams.find((item) => item.id === binding.businessTeamId);
                const provider = snapshot.providers.find((item) => item.id === binding.defaultProviderProfileId);
                const config = parseConfig(binding.configJson);
                return (
                  <DataTableRow key={binding.id}>
                    <DataTableCell>
                      <div className="font-semibold text-[var(--ink)]">{binding.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{binding.id}</div>
                    </DataTableCell>
                    <DataTableCell>{businessTeam?.name ?? "全局默认"}</DataTableCell>
                    <DataTableCell>
                      <div>{provider?.name ?? "未绑定"}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{stringField(config.defaultModel, provider?.defaultModel ?? "未配置")}</div>
                    </DataTableCell>
                    <DataTableCell className="max-w-[280px] truncate">{binding.baseUrl || "内置"}</DataTableCell>
                    <DataTableCell>
                      <Badge variant={binding.isEnabled === 1 ? "success" : "neutral"}>{binding.isEnabled === 1 ? "启用" : "停用"}</Badge>
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
                          <DialogContent className="w-[min(96vw,920px)]">
                            <DialogHeader>
                              <DialogTitle>{binding.name}</DialogTitle>
                              <DialogDescription>模型执行配置明细。</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <DefinitionList
                                columnsClassName="sm:grid-cols-2"
                                items={[
                                  { label: "ID", value: binding.id },
                                  { label: "租户空间", value: binding.tenantSpaceId },
                                  { label: "业务团队", value: businessTeam?.name ?? "全局默认" },
                                  { label: "默认模型服务", value: provider?.name ?? "未绑定" },
                                  { label: "默认模型", value: stringField(config.defaultModel, provider?.defaultModel ?? "未配置") },
                                  { label: "API Key 引用", value: binding.apiKeyRef || provider?.apiKeyRef || "未配置" },
                                  { label: "审批模式", value: stringField(config.approvalMode, "ask") },
                                  { label: "事件协议", value: eventContractLabel(config.eventContract) },
                                  { label: "服务地址", value: binding.baseUrl || "内置" },
                                  { label: "启动命令", value: binding.command || "内置" },
                                  { label: "工作目录", value: binding.workspaceRoot || "." },
                                  { label: "附加配置", value: <pre className="whitespace-pre-wrap font-mono text-xs">{binding.configJson}</pre> },
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
                          <DialogContent className="w-[min(96vw,980px)]">
                            <DialogHeader>
                              <DialogTitle>编辑执行配置</DialogTitle>
                              <DialogDescription>{binding.name}</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <ProviderRuntimeBindingForm
                                embedded
                                title={`编辑 ${binding.name}`}
                                providerOptions={providerOptions}
                                adapterOptions={adapterOptions}
                                businessTeamOptions={businessTeamOptions}
                                binding={binding}
                              />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                        <DeleteResourceButton
                          endpoint="/api/provider-runtime-bindings"
                          id={binding.id}
                          confirmText={`确认删除执行配置「${binding.name}」？`}
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
