import Link from "next/link";
import { Eye, PencilLine, Plus } from "lucide-react";
import { ExecutionEnvironmentForm } from "@/components/execution-environment-form";
import { PageHeader } from "@/components/page-header";
import { ProviderProfileForm } from "@/components/provider-profile-form";
import { ProviderRuntimeBindingForm } from "@/components/provider-runtime-binding-form";
import { WebhookEndpointForm } from "@/components/webhook-endpoint-form";
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
import { Panel, PanelHeader } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { translateStatus } from "@/lib/presentation";
import { getSettingsSnapshot } from "@/server/queries";

function EnabledBadge({ enabled }: { enabled: boolean | number }) {
  return <Badge variant={enabled ? "success" : "neutral"}>{enabled ? "enabled" : "disabled"}</Badge>;
}

function JsonBlock({ value }: { value: string }) {
  return (
    <pre className="max-h-[260px] overflow-auto rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-4 text-xs leading-5 text-[var(--ink-muted)]">
      {value}
    </pre>
  );
}

function ActionButtons({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center justify-end gap-2">{children}</div>;
}

export default function SettingsPage() {
  const snapshot = getSettingsSnapshot();
  const tenantSpaceId = snapshot.tenantSpaces[0]?.id ?? "";
  const defaultBusinessTeamId = snapshot.businessTeams[0]?.id ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="平台配置"
        description="配置清单只保留陈列与入口，查看细节和新增编辑统一通过弹窗完成。"
        badges={[
          { label: `${snapshot.metrics.providerProfileCount} 个模型接口`, variant: "accent" },
          { label: `${snapshot.metrics.runtimeBindingCount} 个执行引擎`, variant: "neutral" },
        ]}
      />

      <SummaryStrip
        items={[
          {
            label: "模型接口",
            value: snapshot.metrics.providerProfileCount,
            detail: `启用 ${snapshot.metrics.enabledProviderProfileCount}`,
          },
          {
            label: "执行引擎实例",
            value: snapshot.metrics.runtimeBindingCount,
            detail: `启用 ${snapshot.metrics.enabledRuntimeBindingCount}`,
          },
          {
            label: "执行环境",
            value: snapshot.environments.length,
            detail: "代码仓与记忆依赖",
          },
          {
            label: "Webhook 入口",
            value: snapshot.webhooks.length,
            detail: `蓝图 ${snapshot.metrics.blueprintCount}`,
          },
        ]}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            eyebrow="Providers"
            title="模型接口"
            description="已配置的模型接口统一在这里陈列。"
            action={
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary">
                    <Plus className="h-4 w-4" />
                    新增
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新增模型接口</DialogTitle>
                    <DialogDescription>通过弹窗维护 Base URL、模型列表和 API Key 引用。</DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <ProviderProfileForm
                      embedded
                      provider={{
                        id: "",
                        tenantSpaceId,
                        name: "新增模型接口",
                        baseUrl: "https://api.openai.com/v1",
                        apiStyle: "openai",
                        defaultModel: "gpt-5.4",
                        modelsJson: JSON.stringify(["gpt-5.4"], null, 2),
                        apiKeyRef: "env:OPENAI_API_KEY",
                        configJson: JSON.stringify({ supportsResponsesApi: true }, null, 2),
                        isEnabled: 1,
                      }}
                      title="新增模型接口"
                    />
                  </DialogBody>
                </DialogContent>
              </Dialog>
            }
          />
          <div className="overflow-hidden rounded-b-2xl">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>接口</DataTableHead>
                  <DataTableHead>API 风格</DataTableHead>
                  <DataTableHead>默认模型</DataTableHead>
                  <DataTableHead>状态</DataTableHead>
                  <DataTableHead align="right">操作</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.providers.map((provider) => (
                  <DataTableRow key={provider.id}>
                    <DataTableCell className="min-w-[220px]">
                      <div className="font-medium text-[var(--ink)]">{provider.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{provider.baseUrl}</div>
                    </DataTableCell>
                    <DataTableCell>{provider.apiStyle}</DataTableCell>
                    <DataTableCell>{provider.defaultModel}</DataTableCell>
                    <DataTableCell>
                      <EnabledBadge enabled={provider.isEnabled} />
                    </DataTableCell>
                    <DataTableCell align="right">
                      <ActionButtons>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button size="sm" variant="ghost">
                              <Eye className="h-4 w-4" />
                              查看
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{provider.name}</DialogTitle>
                              <DialogDescription>模型接口细节与附加配置。</DialogDescription>
                            </DialogHeader>
                            <DialogBody className="space-y-5">
                              <DefinitionList
                                items={[
                                  { label: "接口 ID", value: provider.id },
                                  { label: "API 风格", value: provider.apiStyle },
                                  { label: "Base URL", value: provider.baseUrl },
                                  { label: "默认模型", value: provider.defaultModel },
                                  { label: "Key 引用", value: provider.apiKeyRef },
                                  { label: "状态", value: provider.isEnabled ? "enabled" : "disabled" },
                                ]}
                              />
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--ink)]">模型列表</div>
                                <JsonBlock value={provider.modelsJson} />
                              </div>
                              <div className="space-y-2">
                                <div className="text-sm font-medium text-[var(--ink)]">附加配置</div>
                                <JsonBlock value={provider.configJson} />
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
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>编辑模型接口</DialogTitle>
                              <DialogDescription>{provider.name}</DialogDescription>
                            </DialogHeader>
                            <DialogBody>
                              <ProviderProfileForm embedded provider={provider} title={provider.name} />
                            </DialogBody>
                          </DialogContent>
                        </Dialog>
                      </ActionButtons>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Runtimes"
            title="执行引擎实例"
            description="已配置运行时只在表格里看摘要，细节进入弹窗。"
            action={
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary">
                    <Plus className="h-4 w-4" />
                    新增
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[min(92vw,820px)]">
                  <DialogHeader>
                    <DialogTitle>新增执行引擎实例</DialogTitle>
                    <DialogDescription>配置 OpenCode 地址、命令、默认接口与环境变量映射。</DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <ProviderRuntimeBindingForm
                      embedded
                      binding={{
                        id: "",
                        tenantSpaceId,
                        businessTeamId: defaultBusinessTeamId,
                        adapterDefinitionId: "opencode-provider",
                        name: "新增执行引擎实例",
                        runtimeKind: "opencode",
                        baseUrl: "http://127.0.0.1:4096",
                        command: "opencode",
                        workspaceRoot: process.cwd(),
                        defaultProviderProfileId: snapshot.providers[0]?.id ?? null,
                        apiKeyRef: "env:OPENCODE_API_KEY",
                        configJson: JSON.stringify(
                          {
                            defaultModel: snapshot.providers[0]?.defaultModel ?? "gpt-5.4",
                            env: {
                              OPENAI_API_KEY: "ref:env:OPENAI_API_KEY",
                            },
                          },
                          null,
                          2,
                        ),
                        isEnabled: 1,
                      }}
                      title="新增执行引擎实例"
                      businessTeamOptions={snapshot.businessTeams.map((team) => ({
                        id: team.id,
                        name: team.name,
                      }))}
                      providerOptions={snapshot.providers.map((provider) => ({
                        id: provider.id,
                        name: `${provider.name} / ${provider.defaultModel}`,
                      }))}
                      adapterOptions={snapshot.providerAdapters.map((adapter) => ({
                        id: adapter.id,
                        name: adapter.name,
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
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>实例</DataTableHead>
                  <DataTableHead>业务团队</DataTableHead>
                  <DataTableHead>运行协议</DataTableHead>
                  <DataTableHead>默认接口</DataTableHead>
                  <DataTableHead>状态</DataTableHead>
                  <DataTableHead align="right">操作</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.providerRuntimeBindings.map((binding) => {
                  const team = snapshot.businessTeams.find((item) => item.id === binding.businessTeamId);
                  const provider = snapshot.providers.find((item) => item.id === binding.defaultProviderProfileId);
                  return (
                    <DataTableRow key={binding.id}>
                      <DataTableCell className="min-w-[220px]">
                        <div className="font-medium text-[var(--ink)]">{binding.name}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{binding.baseUrl}</div>
                      </DataTableCell>
                      <DataTableCell>{team?.name ?? "默认空间"}</DataTableCell>
                      <DataTableCell>
                        <div className="text-[var(--ink)]">{binding.runtimeKind}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{binding.adapterDefinitionId}</div>
                      </DataTableCell>
                      <DataTableCell>{provider?.name ?? "未绑定"}</DataTableCell>
                      <DataTableCell>
                        <EnabledBadge enabled={binding.isEnabled} />
                      </DataTableCell>
                      <DataTableCell align="right">
                        <ActionButtons>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <Eye className="h-4 w-4" />
                                查看
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{binding.name}</DialogTitle>
                                <DialogDescription>执行引擎实例的运行地址、权限模式与附加配置。</DialogDescription>
                              </DialogHeader>
                              <DialogBody className="space-y-5">
                                <DefinitionList
                                  items={[
                                    { label: "实例 ID", value: binding.id },
                                    { label: "业务团队", value: team?.name ?? "默认空间" },
                                    { label: "Adapter", value: binding.adapterDefinitionId },
                                    { label: "运行协议", value: binding.runtimeKind },
                                    { label: "Base URL", value: binding.baseUrl },
                                    { label: "启动命令", value: binding.command },
                                    { label: "工作目录", value: binding.workspaceRoot },
                                    { label: "默认接口", value: provider?.name ?? "未绑定" },
                                    { label: "API Key 引用", value: binding.apiKeyRef },
                                    { label: "状态", value: binding.isEnabled ? "enabled" : "disabled" },
                                  ]}
                                />
                                <div className="space-y-2">
                                  <div className="text-sm font-medium text-[var(--ink)]">附加配置</div>
                                  <JsonBlock value={binding.configJson} />
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
                            <DialogContent className="w-[min(92vw,820px)]">
                              <DialogHeader>
                                <DialogTitle>编辑执行引擎实例</DialogTitle>
                                <DialogDescription>{binding.name}</DialogDescription>
                              </DialogHeader>
                              <DialogBody>
                                <ProviderRuntimeBindingForm
                                  embedded
                                  binding={binding}
                                  title={binding.name}
                                  businessTeamOptions={snapshot.businessTeams.map((team) => ({
                                    id: team.id,
                                    name: team.name,
                                  }))}
                                  providerOptions={snapshot.providers.map((provider) => ({
                                    id: provider.id,
                                    name: `${provider.name} / ${provider.defaultModel}`,
                                  }))}
                                  adapterOptions={snapshot.providerAdapters.map((adapter) => ({
                                    id: adapter.id,
                                    name: adapter.name,
                                  }))}
                                />
                              </DialogBody>
                            </DialogContent>
                          </Dialog>
                        </ActionButtons>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Environments"
            title="执行环境"
            description="环境清单只展示核心摘要，仓库与沙箱细节收进弹窗。"
            action={
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary">
                    <Plus className="h-4 w-4" />
                    新增
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[min(92vw,820px)]">
                  <DialogHeader>
                    <DialogTitle>新增执行环境</DialogTitle>
                    <DialogDescription>配置代码仓、执行路径、凭据引用与记忆依赖。</DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <ExecutionEnvironmentForm
                      embedded
                      environment={{
                        id: "",
                        businessTeamId: defaultBusinessTeamId ?? "",
                        name: "新增执行环境",
                        repositoryProvider: "git",
                        repositoryName: "",
                        repositoryUrl: "",
                        defaultBranch: "main",
                        executorRef: "",
                        privateKeyRef: "",
                        workingDirectory: ".",
                        sandboxProfileJson: JSON.stringify({ isolation: "process" }, null, 2),
                        memoryLayerRefsJson: JSON.stringify([], null, 2),
                        visibility: "team",
                        status: "active",
                      }}
                      title="新增执行环境"
                      businessTeamOptions={snapshot.businessTeams.map((team) => ({
                        id: team.id,
                        name: team.name,
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
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>环境</DataTableHead>
                  <DataTableHead>代码仓</DataTableHead>
                  <DataTableHead>分支 / 路径</DataTableHead>
                  <DataTableHead>可见性</DataTableHead>
                  <DataTableHead>状态</DataTableHead>
                  <DataTableHead align="right">操作</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.environments.map((environment) => {
                  const team = snapshot.businessTeams.find((item) => item.id === environment.businessTeamId);
                  return (
                    <DataTableRow key={environment.id}>
                      <DataTableCell className="min-w-[220px]">
                        <div className="font-medium text-[var(--ink)]">{environment.name}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{team?.name ?? "未知业务团队"}</div>
                      </DataTableCell>
                      <DataTableCell>
                        <div className="text-[var(--ink)]">{environment.repositoryName || "未配置"}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{environment.repositoryProvider}</div>
                      </DataTableCell>
                      <DataTableCell>{environment.defaultBranch} / {environment.workingDirectory}</DataTableCell>
                      <DataTableCell>{environment.visibility}</DataTableCell>
                      <DataTableCell>
                        <Badge variant={environment.status === "active" ? "success" : "neutral"}>
                          {translateStatus(environment.status)}
                        </Badge>
                      </DataTableCell>
                      <DataTableCell align="right">
                        <ActionButtons>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <Eye className="h-4 w-4" />
                                查看
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{environment.name}</DialogTitle>
                                <DialogDescription>执行环境的代码仓、凭据和记忆层配置。</DialogDescription>
                              </DialogHeader>
                              <DialogBody className="space-y-5">
                                <DefinitionList
                                  items={[
                                    { label: "环境 ID", value: environment.id },
                                    { label: "业务团队", value: team?.name ?? "未知业务团队" },
                                    { label: "代码仓类型", value: environment.repositoryProvider },
                                    { label: "代码仓名称", value: environment.repositoryName || "未配置" },
                                    { label: "代码仓 URL", value: environment.repositoryUrl || "未配置" },
                                    { label: "默认分支", value: environment.defaultBranch },
                                    { label: "工作目录", value: environment.workingDirectory },
                                    { label: "执行人引用", value: environment.executorRef || "未配置" },
                                    { label: "私钥引用", value: environment.privateKeyRef || "未配置" },
                                    { label: "可见性", value: environment.visibility },
                                    { label: "状态", value: environment.status },
                                  ]}
                                />
                                <div className="space-y-2">
                                  <div className="text-sm font-medium text-[var(--ink)]">沙箱配置</div>
                                  <JsonBlock value={environment.sandboxProfileJson} />
                                </div>
                                <div className="space-y-2">
                                  <div className="text-sm font-medium text-[var(--ink)]">记忆层引用</div>
                                  <JsonBlock value={environment.memoryLayerRefsJson} />
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
                            <DialogContent className="w-[min(92vw,820px)]">
                              <DialogHeader>
                                <DialogTitle>编辑执行环境</DialogTitle>
                                <DialogDescription>{environment.name}</DialogDescription>
                              </DialogHeader>
                              <DialogBody>
                                <ExecutionEnvironmentForm
                                  embedded
                                  environment={environment}
                                  title={environment.name}
                                  businessTeamOptions={snapshot.businessTeams.map((team) => ({
                                    id: team.id,
                                    name: team.name,
                                  }))}
                                />
                              </DialogBody>
                            </DialogContent>
                          </Dialog>
                        </ActionButtons>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </div>
        </Panel>

        <Panel>
          <PanelHeader
            eyebrow="Webhook Intake"
            title="Webhook 入口"
            description="入口清单保持简洁，Schema 与签名提示只在弹窗内查看。"
            action={
              <Dialog>
                <DialogTrigger asChild>
                  <Button size="sm" variant="secondary">
                    <Plus className="h-4 w-4" />
                    新增
                  </Button>
                </DialogTrigger>
                <DialogContent className="w-[min(92vw,760px)]">
                  <DialogHeader>
                    <DialogTitle>新增 Webhook 入口</DialogTitle>
                    <DialogDescription>配置路径、归属团队、签名提示和请求 Schema。</DialogDescription>
                  </DialogHeader>
                  <DialogBody>
                    <WebhookEndpointForm
                      embedded
                      webhook={{
                        id: "",
                        businessTeamId: defaultBusinessTeamId ?? "",
                        teamId: snapshot.agentTeams[0]?.id ?? "",
                        name: "新增 Webhook 入口",
                        pathKey: "",
                        method: "POST",
                        requestSchemaJson: JSON.stringify({}, null, 2),
                        secretHint: "env:CODE_PLATFORM_WEBHOOK_SECRET",
                        isEnabled: 1,
                      }}
                      title="新增 Webhook 入口"
                      businessTeamOptions={snapshot.businessTeams.map((team) => ({
                        id: team.id,
                        name: team.name,
                      }))}
                      agentTeamOptions={snapshot.agentTeams.map((team) => ({
                        id: team.id,
                        name: team.name,
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
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>入口</DataTableHead>
                  <DataTableHead>业务团队</DataTableHead>
                  <DataTableHead>Agent 团队</DataTableHead>
                  <DataTableHead>方法 / 路径</DataTableHead>
                  <DataTableHead>状态</DataTableHead>
                  <DataTableHead align="right">操作</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.webhooks.map((webhook) => {
                  const businessTeam = snapshot.businessTeams.find((item) => item.id === webhook.businessTeamId);
                  const agentTeam = snapshot.agentTeams.find((item) => item.id === webhook.teamId);
                  return (
                    <DataTableRow key={webhook.id}>
                      <DataTableCell className="min-w-[220px]">
                        <div className="font-medium text-[var(--ink)]">{webhook.name}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{webhook.pathKey}</div>
                      </DataTableCell>
                      <DataTableCell>{businessTeam?.name ?? "未知业务团队"}</DataTableCell>
                      <DataTableCell>{agentTeam?.name ?? "未知 Agent 团队"}</DataTableCell>
                      <DataTableCell>{webhook.method} / {webhook.pathKey}</DataTableCell>
                      <DataTableCell>
                        <EnabledBadge enabled={webhook.isEnabled} />
                      </DataTableCell>
                      <DataTableCell align="right">
                        <ActionButtons>
                          <Dialog>
                            <DialogTrigger asChild>
                              <Button size="sm" variant="ghost">
                                <Eye className="h-4 w-4" />
                                查看
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>{webhook.name}</DialogTitle>
                                <DialogDescription>Webhook 入口的签名提示和请求 Schema。</DialogDescription>
                              </DialogHeader>
                              <DialogBody className="space-y-5">
                                <DefinitionList
                                  items={[
                                    { label: "入口 ID", value: webhook.id },
                                    { label: "业务团队", value: businessTeam?.name ?? "未知业务团队" },
                                    { label: "Agent 团队", value: agentTeam?.name ?? "未知 Agent 团队" },
                                    { label: "HTTP 方法", value: webhook.method },
                                    { label: "路径标识", value: webhook.pathKey },
                                    { label: "签名提示", value: webhook.secretHint || "未配置" },
                                    { label: "状态", value: webhook.isEnabled ? "enabled" : "disabled" },
                                  ]}
                                />
                                <div className="space-y-2">
                                  <div className="text-sm font-medium text-[var(--ink)]">请求 Schema</div>
                                  <JsonBlock value={webhook.requestSchemaJson} />
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
                            <DialogContent className="w-[min(92vw,760px)]">
                              <DialogHeader>
                                <DialogTitle>编辑 Webhook 入口</DialogTitle>
                                <DialogDescription>{webhook.name}</DialogDescription>
                              </DialogHeader>
                              <DialogBody>
                                <WebhookEndpointForm
                                  embedded
                                  webhook={webhook}
                                  title={webhook.name}
                                  businessTeamOptions={snapshot.businessTeams.map((team) => ({
                                    id: team.id,
                                    name: team.name,
                                  }))}
                                  agentTeamOptions={snapshot.agentTeams.map((team) => ({
                                    id: team.id,
                                    name: team.name,
                                  }))}
                                />
                              </DialogBody>
                            </DialogContent>
                          </Dialog>
                        </ActionButtons>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </div>
        </Panel>
      </div>

      <Panel>
        <PanelHeader
          eyebrow="Blueprints"
          title="任务蓝图目录"
          description="任务蓝图移到独立目录维护，避免在设置页继续堆叠配置内容。"
          action={
            <Button asChild size="sm" variant="secondary">
              <Link href="/task-blueprints">打开任务蓝图</Link>
            </Button>
          }
        />
      </Panel>
    </div>
  );
}
