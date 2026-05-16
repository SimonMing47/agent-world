import Link from "next/link";
import { ExecutionEnvironmentForm } from "@/components/execution-environment-form";
import { PageHeader } from "@/components/page-header";
import { ProviderProfileForm } from "@/components/provider-profile-form";
import { ProviderRuntimeBindingForm } from "@/components/provider-runtime-binding-form";
import { WebhookEndpointForm } from "@/components/webhook-endpoint-form";
import { Badge } from "@/components/ui/badge";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeader,
  DataTableRow,
} from "@/components/ui/data-table";
import { Panel, PanelBody } from "@/components/ui/panel";
import { SummaryStrip } from "@/components/ui/summary-strip";
import { translateStatus } from "@/lib/presentation";
import { getSettingsSnapshot } from "@/server/queries";

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--ink-muted)]">{eyebrow}</div>
      <h2 className="mt-1 text-lg font-semibold text-[var(--ink)]">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--ink-muted)]">{description}</p>
    </div>
  );
}

function EnabledBadge({ enabled }: { enabled: boolean | number }) {
  return <Badge variant={enabled ? "success" : "neutral"}>{enabled ? "enabled" : "disabled"}</Badge>;
}

export default function SettingsPage() {
  const snapshot = getSettingsSnapshot();
  const tenantSpaceId = snapshot.tenantSpaces[0]?.id ?? "";
  const defaultBusinessTeamId = snapshot.businessTeams[0]?.id ?? null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Settings"
        title="平台配置"
        description="在同一组控制台页面里维护模型接口、执行引擎、环境、Webhook 和蓝图入口。"
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
            label: "任务蓝图",
            value: snapshot.metrics.blueprintCount,
            detail: `启用 ${snapshot.metrics.enabledBlueprintCount}`,
          },
          {
            label: "Webhook / 环境",
            value: `${snapshot.webhooks.length} / ${snapshot.environments.length}`,
            detail: "Webhook 入口 / 执行环境",
          },
        ]}
      />

      <section className="space-y-4">
        <SectionHeading
          eyebrow="OpenCode Runtime"
          title="执行引擎实例"
          description="配置真正进入数据库的 OpenCode 运行地址、命令、默认模型接口、API Key 引用和环境变量。"
        />
        <Panel>
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>实例</DataTableHead>
                  <DataTableHead>业务团队</DataTableHead>
                  <DataTableHead>Adapter</DataTableHead>
                  <DataTableHead>Base URL</DataTableHead>
                  <DataTableHead>默认模型接口</DataTableHead>
                  <DataTableHead>状态</DataTableHead>
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
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{binding.command}</div>
                      </DataTableCell>
                      <DataTableCell>{team?.name ?? "默认空间"}</DataTableCell>
                      <DataTableCell>{binding.adapterDefinitionId}</DataTableCell>
                      <DataTableCell>{binding.baseUrl}</DataTableCell>
                      <DataTableCell>{provider?.name ?? "未绑定"}</DataTableCell>
                      <DataTableCell>
                        <EnabledBadge enabled={binding.isEnabled} />
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </PanelBody>
        </Panel>
        <div className="grid gap-4 2xl:grid-cols-2">
          {snapshot.providerRuntimeBindings.map((binding) => (
            <ProviderRuntimeBindingForm
              key={binding.id}
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
          ))}
          <ProviderRuntimeBindingForm
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
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Model Providers"
          title="模型接口目录"
          description="维护 Base URL、默认模型、模型列表、API 风格和 Key 引用。"
        />
        <Panel>
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>接口</DataTableHead>
                  <DataTableHead>Base URL</DataTableHead>
                  <DataTableHead>API 风格</DataTableHead>
                  <DataTableHead>默认模型</DataTableHead>
                  <DataTableHead>Key 引用</DataTableHead>
                  <DataTableHead>状态</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.providers.map((provider) => (
                  <DataTableRow key={provider.id}>
                    <DataTableCell className="min-w-[220px]">
                      <div className="font-medium text-[var(--ink)]">{provider.name}</div>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{provider.id}</div>
                    </DataTableCell>
                    <DataTableCell>{provider.baseUrl}</DataTableCell>
                    <DataTableCell>{provider.apiStyle}</DataTableCell>
                    <DataTableCell>{provider.defaultModel}</DataTableCell>
                    <DataTableCell>{provider.apiKeyRef}</DataTableCell>
                    <DataTableCell>
                      <EnabledBadge enabled={provider.isEnabled} />
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </PanelBody>
        </Panel>
        <div className="grid gap-4 2xl:grid-cols-2">
          {snapshot.providers.map((provider) => (
            <ProviderProfileForm key={provider.id} provider={provider} title={provider.name} />
          ))}
          <ProviderProfileForm
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
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Environments"
          title="执行环境"
          description="代码仓、执行路径、私钥引用与记忆依赖。"
        />
        <Panel>
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>环境</DataTableHead>
                  <DataTableHead>业务团队</DataTableHead>
                  <DataTableHead>代码仓</DataTableHead>
                  <DataTableHead>分支 / 路径</DataTableHead>
                  <DataTableHead>可见性</DataTableHead>
                  <DataTableHead>状态</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.environments.map((environment) => {
                  const team = snapshot.businessTeams.find((item) => item.id === environment.businessTeamId);
                  return (
                    <DataTableRow key={environment.id}>
                      <DataTableCell className="min-w-[220px]">
                        <div className="font-medium text-[var(--ink)]">{environment.name}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{environment.repositoryProvider}</div>
                      </DataTableCell>
                      <DataTableCell>{team?.name ?? "未知业务团队"}</DataTableCell>
                      <DataTableCell>
                        <div className="font-medium text-[var(--ink)]">{environment.repositoryName || "未配置"}</div>
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{environment.repositoryUrl || "无 URL"}</div>
                      </DataTableCell>
                      <DataTableCell>
                        {environment.defaultBranch} / {environment.workingDirectory}
                      </DataTableCell>
                      <DataTableCell>{environment.visibility}</DataTableCell>
                      <DataTableCell>
                        <Badge variant={environment.status === "active" ? "success" : "neutral"}>
                          {translateStatus(environment.status)}
                        </Badge>
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </PanelBody>
        </Panel>
        <div className="grid gap-4 2xl:grid-cols-2">
          {snapshot.environments.map((environment) => (
            <ExecutionEnvironmentForm
              key={environment.id}
              environment={environment}
              title={environment.name}
              businessTeamOptions={snapshot.businessTeams.map((team) => ({
                id: team.id,
                name: team.name,
              }))}
            />
          ))}
          <ExecutionEnvironmentForm
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
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Webhook Intake"
          title="Webhook 入口"
          description="路径、签名密钥提示、归属业务团队和接收 Agent 团队全部落库管理。"
        />
        <Panel>
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>入口</DataTableHead>
                  <DataTableHead>业务团队</DataTableHead>
                  <DataTableHead>Agent 团队</DataTableHead>
                  <DataTableHead>方法 / 路径</DataTableHead>
                  <DataTableHead>签名提示</DataTableHead>
                  <DataTableHead>状态</DataTableHead>
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
                        <div className="mt-1 text-xs text-[var(--ink-muted)]">{webhook.id}</div>
                      </DataTableCell>
                      <DataTableCell>{businessTeam?.name ?? "未知业务团队"}</DataTableCell>
                      <DataTableCell>{agentTeam?.name ?? "未知 Agent 团队"}</DataTableCell>
                      <DataTableCell>
                        {webhook.method} / {webhook.pathKey}
                      </DataTableCell>
                      <DataTableCell>{webhook.secretHint || "无"}</DataTableCell>
                      <DataTableCell>
                        <EnabledBadge enabled={webhook.isEnabled} />
                      </DataTableCell>
                    </DataTableRow>
                  );
                })}
              </DataTableBody>
            </DataTable>
          </PanelBody>
        </Panel>
        <div className="grid gap-4 2xl:grid-cols-2">
          {snapshot.webhooks.map((webhook) => (
            <WebhookEndpointForm
              key={webhook.id}
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
          ))}
          <WebhookEndpointForm
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
        </div>
      </section>

      <section className="space-y-4">
        <SectionHeading
          eyebrow="Blueprint Status"
          title="任务蓝图入口"
          description="进入蓝图详情页查看触发器、权限预览、最近运行和提交控制台。"
        />
        <Panel>
          <PanelBody className="p-0">
            <DataTable>
              <DataTableHeader>
                <DataTableRow className="hover:bg-transparent">
                  <DataTableHead>蓝图</DataTableHead>
                  <DataTableHead>类别</DataTableHead>
                  <DataTableHead>Provider Adapter</DataTableHead>
                  <DataTableHead>环境</DataTableHead>
                  <DataTableHead>状态</DataTableHead>
                </DataTableRow>
              </DataTableHeader>
              <DataTableBody>
                {snapshot.taskBlueprints.map((blueprint) => (
                  <DataTableRow key={blueprint.id}>
                    <DataTableCell className="min-w-[260px]">
                      <Link href={`/task-blueprints/${blueprint.id}`} className="font-medium text-[var(--ink)] hover:underline">
                        {blueprint.name}
                      </Link>
                      <div className="mt-1 text-xs text-[var(--ink-muted)]">{blueprint.id}</div>
                    </DataTableCell>
                    <DataTableCell>{blueprint.category}</DataTableCell>
                    <DataTableCell>{blueprint.providerAdapterId}</DataTableCell>
                    <DataTableCell>{blueprint.environmentId ?? "未绑定"}</DataTableCell>
                    <DataTableCell>
                      <Badge variant={blueprint.status === "active" ? "success" : "neutral"}>
                        {translateStatus(blueprint.status)}
                      </Badge>
                    </DataTableCell>
                  </DataTableRow>
                ))}
              </DataTableBody>
            </DataTable>
          </PanelBody>
        </Panel>
      </section>
    </div>
  );
}
